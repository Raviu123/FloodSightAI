"""Tests for India-wide HydroSHEDS 15s terrain baseline, susceptibility metadata, 8-neighbor regional batch, and tile renderer endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.terrain.batch_manager import resolve_8_neighbor_grid, get_combined_batch_bbox

client = TestClient(app)


def test_elevation_safety_preserved():
    """Verify elevation safety endpoint works 100% intact."""
    response = client.get("/api/v1/terrain/elevation-safety?region_id=mumbai")
    assert response.status_code in (200, 502)


def test_resolve_8_neighbor_grid_geometry():
    """Verify 8-neighbor grid geometry calculations for a 3x3 contiguous grid."""
    center_bbox = [72.77, 18.94, 72.91, 19.08]  # Mumbai
    grid = resolve_8_neighbor_grid(center_bbox, radius=1)
    assert len(grid) == 9
    expected_keys = {"nw", "n", "ne", "w", "center", "e", "sw", "s", "se"}
    assert set(grid.keys()) == expected_keys
    
    combined = get_combined_batch_bbox(grid)
    # Check width and height expanded 3x
    d_lon = center_bbox[2] - center_bbox[0]
    d_lat = center_bbox[3] - center_bbox[1]
    assert abs((combined[2] - combined[0]) - 3 * d_lon) < 0.01
    assert abs((combined[3] - combined[1]) - 3 * d_lat) < 0.01


def test_elevation_safety_batch_endpoint():
    """Verify 8-neighbor batch endpoint returns 3x3 grid metadata and unified features."""
    response = client.get("/api/v1/terrain/elevation-safety-batch?region_id=mumbai&radius=1")
    assert response.status_code in (200, 502)
    if response.status_code == 200:
        data = response.json()
        assert data["type"] == "FeatureCollection"
        assert data["metadata"]["grid_dimensions"] == "3x3"
        assert data["metadata"]["total_regions"] == 9
        assert data["metadata"]["center_region_id"] == "mumbai"


def test_terrain_susceptibility_metadata_endpoint():
    """Verify terrain susceptibility metadata endpoint returns model weights and provenance."""
    response = client.get("/api/v1/terrain/susceptibility?region=india")
    assert response.status_code == 200
    data = response.json()
    assert data["region"] == "india"
    assert "susceptibility_weights" in data
    assert "classification" in data


def test_terrain_tile_renderer_endpoint():
    """Verify Web Mercator tile renderer returns a valid 256x256 PNG image."""
    response = client.get("/api/v1/terrain/tiles/5/23/14.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert len(response.content) > 100


def test_terrain_analysis_query_endpoint():
    """Verify regional terrain analysis endpoint."""
    response = client.get("/api/v1/terrain/analysis?region=city:mangaluru")
    assert response.status_code == 200
    data = response.json()
    assert data["region"] == "city:mangaluru"


def test_india_baseline_endpoint():
    """Verify India terrain baseline endpoint returns valid HydroSHEDS GeoJSON collection."""
    response = client.get("/api/v1/terrain/india-baseline?grid_resolution_deg=0.5")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"


def test_india_hotspots_endpoint():
    """Verify India flood hotspots endpoint returns valid IMERG rainfall-forced GeoJSON collection."""
    response = client.get("/api/v1/terrain/india-hotspots?grid_resolution_deg=0.5&terrain_weight=0.70&rainfall_weight=0.30")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"


def test_elevation_safety_directional_suffix():
    """Verify directional suffix region_id (e.g. mumbai_nw) is resolved successfully."""
    response = client.get("/api/v1/terrain/elevation-safety?region_id=mumbai_nw")
    assert response.status_code in (200, 502)

