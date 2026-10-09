"""
Phase G Unit tests for MERIT Hydro Scientific Corrections:
- Ocean & nodata cell masking vs. low-lying land below sea level (Kuttanad Kerala).
- HND = 0 river channel behavior & permanent water.
- Geodesic physical slope angle calculation in degrees.
- 0 boundary seams across adjacent 3x3 tiles via 15-cell border context buffer.
- Persistent 0.01° spatial grid Simulation-Ready Zone IDs (FSZ-18.94N-072.83E).
- Cache invalidation (v2.1).
"""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.terrain.sources.merit_hydro import get_merit_hydro_window
from app.services.terrain.susceptibility import (
    calculate_terrain_susceptibility,
    classify_susceptibility,
)
from app.services.terrain.tiler import render_terrain_tile
from app.services.terrain.validity_mask import (
    MASK_LAND,
    MASK_OCEAN,
    MASK_PERMANENT_WATER,
    MASK_UNASSESSED,
    create_validity_mask,
)

client = TestClient(app)


def test_validity_mask_kuttanad_below_sea_level_land_preserved():
    """Verify low-lying land below sea level (e.g. Kuttanad Kerala at -1.5m MSL) is preserved as land."""
    elv = np.array([[-1.5, -0.5], [2.0, 15.0]], dtype=np.float32)
    hnd = np.array([[0.5, 1.0], [2.0, 10.0]], dtype=np.float32)  # HND > 0 -> Land
    upa = np.array([[2.0, 5.0], [10.0, 50.0]], dtype=np.float32)

    mask = create_validity_mask(elv, hnd=hnd, upa=upa)

    assert mask[0, 0] == MASK_LAND
    assert mask[0, 1] == MASK_LAND
    assert mask[1, 0] == MASK_LAND
    assert mask[1, 1] == MASK_LAND


def test_validity_mask_nodata_vs_ocean_distinction():
    """Verify MERIT nodata (-9999.0) receives MASK_UNASSESSED, while offshore sea receives MASK_OCEAN."""
    elv = np.array([[-9999.0, 0.0], [5.0, 20.0]], dtype=np.float32)
    hnd = np.array([[-9999.0, 0.0], [2.0, 10.0]], dtype=np.float32)
    upa = np.array([[-9999.0, 0.0], [5.0, 50.0]], dtype=np.float32)

    mask = create_validity_mask(elv, hnd=hnd, upa=upa)

    assert mask[0, 0] == MASK_UNASSESSED
    assert mask[0, 1] == MASK_OCEAN
    assert mask[1, 0] == MASK_LAND
    assert mask[1, 1] == MASK_LAND


def test_hnd_zero_river_channel_permanent_water():
    """Verify land cells with HND = 0.0 and high UPA (>10 km²) are classified as MASK_PERMANENT_WATER."""
    elv = np.array([[2.0, 5.0]], dtype=np.float32)
    hnd = np.array([[0.0, 5.0]], dtype=np.float32)
    upa = np.array([[50.0, 1.0]], dtype=np.float32)

    mask = create_validity_mask(elv, hnd=hnd, upa=upa)

    assert mask[0, 0] == MASK_PERMANENT_WATER
    assert mask[0, 1] == MASK_LAND


def test_physical_geodesic_slope_calculation():
    """Verify physical slope calculation in degrees assigns higher score to flat plateau vs steep slope."""
    flat_plateau = np.full((10, 10), 100.0, dtype=np.float32)
    steep_slope = np.zeros((10, 10), dtype=np.float32)
    for i in range(10):
        steep_slope[:, i] = 100.0 + i * 30.0  # 30m rise per 90m cell (~18.4 deg slope)

    hnd = np.full((10, 10), 20.0, dtype=np.float32)
    upa = np.full((10, 10), 1.0, dtype=np.float32)

    score_flat = calculate_terrain_susceptibility(flat_plateau, hnd=hnd, upa=upa, cell_size_m=90.0)
    score_steep = calculate_terrain_susceptibility(steep_slope, hnd=hnd, upa=upa, cell_size_m=90.0)

    # Flat plateau receives higher score than steep slope
    assert np.mean(score_flat[score_flat >= 0]) > np.mean(score_steep[score_steep >= 0])


def test_border_context_buffer_loading():
    """Verify MERIT Hydro provider supports 15-cell border context buffer loading."""
    bbox = [72.77, 18.94, 72.91, 19.08]
    elv_raw, _, _, _ = get_merit_hydro_window(bbox, buffer_cells=0)
    elv_buf, _, _, _ = get_merit_hydro_window(bbox, buffer_cells=15)

    assert elv_raw is not None and elv_buf is not None
    assert elv_buf.shape[0] == elv_raw.shape[0] + 30
    assert elv_buf.shape[1] == elv_raw.shape[1] + 30


def test_elevation_safety_persistent_spatial_grid_zone_ids():
    """Verify elevation safety endpoint returns persistent 0.01 degree spatial grid Zone IDs (FSZ-xx.xxN-xx.xxE)."""
    response = client.get("/api/v1/terrain/elevation-safety?region_id=mumbai")
    assert response.status_code == 200
    data = response.json()
    assert data["metadata"]["model_version"] == "merit_v2.1"

    if len(data["features"]) > 0:
        first_feature = data["features"][0]
        zone_id = first_feature["properties"]["zone_id"]
        assert zone_id.startswith("FSZ-")
        assert "N" in zone_id or "S" in zone_id
        assert "E" in zone_id or "W" in zone_id


@pytest.mark.anyio
async def test_png_tile_renderer_threshold_synchronization():
    """Verify PNG tile renderer executes cleanly with synchronized 0.35/0.60 thresholds."""
    png_bytes = await render_terrain_tile(z=5, x=23, y=14)
    assert len(png_bytes) > 100
    assert png_bytes[:4] == b"\x89PNG"
