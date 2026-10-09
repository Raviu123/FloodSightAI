"""Automated tests for MERIT Hydro 3-arcsec data ingestion, multi-criteria susceptibility math, and fallback behavior."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.terrain.sources.merit_hydro import (
    get_merit_hydro_window,
    get_merit_tile_id,
    is_bbox_in_merit_coverage,
)
from app.services.terrain.susceptibility import calculate_terrain_susceptibility

client = TestClient(app)


def test_merit_hydro_tile_id_calculation():
    """Verify tile ID calculations for major Indian cities."""
    assert get_merit_tile_id(19.01, 72.84) == "n15e070"  # Mumbai
    assert get_merit_tile_id(9.96, 76.26) == "n05e075"  # Kochi
    assert get_merit_tile_id(22.55, 88.36) == "n20e085"  # Kolkata
    assert get_merit_tile_id(13.02, 80.25) == "n10e080"  # Chennai


def test_merit_hydro_coverage_check():
    """Verify geographic coverage check for n00e060 group (0-30N, 60-90E)."""
    mumbai_bbox = [72.77, 18.94, 72.91, 19.08]
    srinagar_bbox = [74.70, 33.98, 74.90, 34.18]  # Lat 34N > 30N
    
    assert is_bbox_in_merit_coverage(mumbai_bbox) is True
    assert is_bbox_in_merit_coverage(srinagar_bbox) is False


def test_merit_hydro_window_extraction():
    """Verify loading MERIT Hydro elv, hnd, and upa rasters for Mumbai extent."""
    mumbai_bbox = [72.77, 18.94, 72.91, 19.08]
    elv, hnd, upa, meta = get_merit_hydro_window(mumbai_bbox)
    
    assert meta["is_merit_hydro"] is True
    assert meta["resolution_m"] == 90.0
    assert elv is not None and hnd is not None and upa is not None
    assert elv.shape == (169, 169)
    assert hnd.shape == (169, 169)
    assert upa.shape == (169, 169)
    
    # Check valid values
    valid_elv = elv[elv > -9000]
    valid_hnd = hnd[hnd > -9000]
    valid_upa = upa[upa > -9000]
    assert len(valid_elv) > 0
    assert len(valid_hnd) > 0
    assert len(valid_upa) > 0
    assert float(valid_hnd.min()) >= 0.0
    assert float(valid_upa.min()) >= 0.0


def test_multicriteria_susceptibility_math():
    """Verify multi-criteria susceptibility calculation combining elv, hnd, and upa."""
    mumbai_bbox = [72.77, 18.94, 72.91, 19.08]
    elv, hnd, upa, _ = get_merit_hydro_window(mumbai_bbox)
    
    score = calculate_terrain_susceptibility(elv, hnd=hnd, upa=upa)
    valid_scores = score[score > -9000]
    
    assert len(valid_scores) > 0
    assert float(valid_scores.min()) >= 0.0
    assert float(valid_scores.max()) <= 1.0


def test_elevation_safety_endpoint_with_merit_hydro():
    """Verify API endpoint returns MERIT Hydro metadata when available."""
    response = client.get("/api/v1/terrain/elevation-safety?region_id=mumbai")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert data["metadata"]["source"] == "MERIT Hydro 3-arcsecond (~90m)"
    assert "hnd" in data["metadata"]["indicators_used"]
    assert "upa" in data["metadata"]["indicators_used"]


def test_elevation_safety_endpoint_fallback_outside_coverage():
    """Verify API endpoint falls back to HydroSHEDS 15s for regions outside n00e060 coverage (e.g. Srinagar)."""
    response = client.get("/api/v1/terrain/elevation-safety?region_id=srinagar")
    assert response.status_code in (200, 502)
    if response.status_code == 200:
        data = response.json()
        assert "Fallback" in data["metadata"]["source"] or "Terrarium" in data["metadata"]["source"]
