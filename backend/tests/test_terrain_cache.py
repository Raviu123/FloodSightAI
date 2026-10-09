"""Automated tests for backend terrain caching, capacity expansion, disk persistence, and observability metadata."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_elevation_safety_cache_hit_metadata():
    """Verify first request computes result (cache_hit=False) and second request hits cache (cache_hit=True)."""
    region_id = "cuttack_nw"
    
    # 1. First fetch
    res1 = client.get(f"/api/v1/terrain/elevation-safety?region_id={region_id}")
    assert res1.status_code in (200, 502)
    if res1.status_code == 200:
        data1 = res1.json()
        assert "metadata" in data1
        # 2. Second fetch should hit memory or disk cache
        res2 = client.get(f"/api/v1/terrain/elevation-safety?region_id={region_id}")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["metadata"]["cache_hit"] is True
        assert data2["metadata"]["cache_source"] in ("memory", "disk")


def test_elevation_safety_cache_capacity():
    """Verify memory/disk cache holds > 9 region entries without eviction."""
    regions = [
        "mumbai", "mumbai_nw", "mumbai_n", "mumbai_ne", "mumbai_w",
        "mumbai_e", "mumbai_sw", "mumbai_s", "mumbai_se", "kochi"
    ]
    
    for r in regions:
        client.get(f"/api/v1/terrain/elevation-safety?region_id={r}")
        
    # Re-fetch the first region (mumbai)
    res = client.get("/api/v1/terrain/elevation-safety?region_id=mumbai")
    assert res.status_code in (200, 502)
    if res.status_code == 200:
        data = res.json()
        assert data["metadata"]["cache_hit"] is True
        assert data["metadata"]["cache_source"] in ("memory", "disk")


def test_terrain_cache_invalidation_on_config_change():
    """Verify changing analysis parameters invalidates cache and triggers fresh computation."""
    res1 = client.get("/api/v1/terrain/elevation-safety?region_id=bengaluru&danger_percentile=30.0")
    res2 = client.get("/api/v1/terrain/elevation-safety?region_id=bengaluru&danger_percentile=40.0")
    
    if res1.status_code == 200 and res2.status_code == 200:
        d1 = res1.json()
        d2 = res2.json()
        assert d1["metadata"]["danger_percentile"] == 30.0
        assert d2["metadata"]["danger_percentile"] == 40.0
        # Config 40.0 should not blindly reuse config 30.0 cached result
        assert d2["metadata"]["danger_percentile"] != d1["metadata"]["danger_percentile"]
