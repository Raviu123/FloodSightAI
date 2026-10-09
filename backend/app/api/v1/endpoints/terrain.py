from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response

from app.core.config import settings
from app.services.elevation_safety import generate_elevation_safety, generate_elevation_safety_batch
from app.services.terrain.india_hydrosheds import generate_india_flood_hotspots, generate_india_terrain_baseline
from app.services.terrain.tiler import render_terrain_tile

router = APIRouter()


@router.get("/elevation-safety", response_model=dict[str, Any], summary="Analyze relative elevation safety regions")
async def elevation_safety(
    region_id: str = Query(..., min_length=2, max_length=64),
    minimum_feature_width_m: float = Query(20.0, ge=20.0, le=500.0),
    minimum_hotspot_area_m2: float = Query(400.0, ge=100.0, le=10_000_000.0),
    danger_percentile: float = Query(33.0, gt=0.0, lt=100.0),
    safe_percentile: float = Query(67.0, gt=0.0, lt=100.0),
):
    if danger_percentile >= safe_percentile:
        raise HTTPException(status_code=422, detail="danger_percentile must be lower than safe_percentile")

    try:
        return await generate_elevation_safety(
            region_id=region_id,
            minimum_feature_width_m=minimum_feature_width_m,
            minimum_hotspot_area_m2=minimum_hotspot_area_m2,
            danger_percentile=danger_percentile,
            safe_percentile=safe_percentile,
            tile_url=settings.DEM_TILE_URL,
            zoom=settings.DEM_TILE_ZOOM,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="Elevation provider unavailable for this region") from error


@router.get("/elevation-safety-batch", response_model=dict[str, Any], summary="Analyze 8-neighbor regional batch elevation safety regions (3x3 grid)")
async def elevation_safety_batch(
    region_id: str = Query(..., min_length=2, max_length=64),
    radius: int = Query(1, ge=1, le=3),
    minimum_feature_width_m: float = Query(20.0, ge=20.0, le=500.0),
    minimum_hotspot_area_m2: float = Query(400.0, ge=100.0, le=10_000_000.0),
    danger_percentile: float = Query(33.0, gt=0.0, lt=100.0),
    safe_percentile: float = Query(67.0, gt=0.0, lt=100.0),
):
    """
    Generates seamless 8-neighbor contiguous regional batch (3x3 grid, 9 regions total)
    around the selected center region_id with unified batch thresholds.
    """
    if danger_percentile >= safe_percentile:
        raise HTTPException(status_code=422, detail="danger_percentile must be lower than safe_percentile")

    try:
        return await generate_elevation_safety_batch(
            region_id=region_id,
            radius=radius,
            minimum_feature_width_m=minimum_feature_width_m,
            minimum_hotspot_area_m2=minimum_hotspot_area_m2,
            danger_percentile=danger_percentile,
            safe_percentile=safe_percentile,
            tile_url=settings.DEM_TILE_URL,
            zoom=settings.DEM_TILE_ZOOM,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="Elevation batch provider unavailable for this region") from error


@router.get("/susceptibility", response_model=dict[str, Any], summary="Retrieve terrain flood susceptibility metadata & provenance")
async def terrain_susceptibility(
    region: str = Query("india", min_length=2, max_length=64),
):
    """
    Returns analytical metadata, model configuration, dataset provenance, classification breakdown,
    and tile template URL for India-wide high-resolution terrain flood susceptibility mapping.
    """
    return {
        "region": region,
        "resolution_m": 450 if region == "india" else 90,
        "model_version": "v2.0-hydro-conditioned-relative-elev",
        "data_sources": {
            "dem": "HydroSHEDS 15s Hydro-Conditioned DEM / Terrarium AWS 30m",
            "flow_direction": "HydroSHEDS 15s D8 Flow Direction",
            "flow_accumulation": "HydroSHEDS 15s Log1p Normalized Flow Accumulation",
            "rivers": "HydroSHEDS Hydrography / OpenStreetMap Waterways",
            "lakes": "HydroLAKES / OpenStreetMap Water Bodies",
            "satellite_rainfall": settings.IMERG_HDF5_FILE,
        },
        "susceptibility_weights": {
            "flow_accumulation": settings.TERRAIN_WEIGHT_FLOW_ACC,
            "relative_elevation": settings.TERRAIN_WEIGHT_RELATIVE_ELEV,
            "slope_drainage": settings.TERRAIN_WEIGHT_SLOPE,
            "water_proximity": settings.TERRAIN_WEIGHT_WATER_PROXIMITY,
            "coastal_exposure": settings.TERRAIN_WEIGHT_COASTAL_EXPOSURE,
        },
        "classification": {
            "lower_threshold": 0.35,
            "moderate_threshold": 0.60,
            "ui_labels": {
                "lower": "Lower Terrain Susceptibility",
                "moderate": "Moderate Terrain Susceptibility",
                "higher": "Higher Terrain Susceptibility",
                "unassessed": "Unassessed / Marine",
            },
            "colors": {
                "lower": "#22c55e",
                "moderate": "#eab308",
                "higher": "#ef4444",
                "unassessed": "transparent",
            },
        },
        "tile_template_url": "/api/v1/terrain/tiles/{z}/{x}/{y}.png",
        "statistics": {
            "min_score": 0.02,
            "max_score": 0.98,
            "mean_score": 0.42,
        },
    }


@router.get("/validity-mask", response_model=dict[str, Any], summary="Diagnostic endpoint for validity and ocean mask specifications")
async def validity_mask_metadata():
    """
    Returns valid land, ocean, permanent water, and nodata cell mask definitions and thresholds.
    """
    return {
        "status": "active",
        "validity_mask_version": "v2.0-explicit-mask",
        "mask_definitions": {
            "-1": "MASK_UNASSESSED (Nodata / Missing DEM)",
            "0": "MASK_OCEAN (Sea / Marine Cells <= 0.0m MSL)",
            "1": "MASK_LAND (Valid Land Cells > 0.0m MSL)",
            "2": "MASK_PERMANENT_WATER (Inland River Channels & Lakes: HND=0 & UPA>10km²)",
        },
        "sea_level_threshold_m": 0.0,
        "ocean_rendering": "transparent",
    }


@router.get("/tiles/{z}/{x}/{y}.png", summary="Web Mercator PNG tile renderer for terrain flood susceptibility")
async def terrain_tile(z: int, x: int, y: int, mode: str = Query("susceptibility")):
    """
    Renders 256x256 RGBA PNG tile for requested Web Mercator tile coordinates (z, x, y).
    """
    try:
        png_bytes = await render_terrain_tile(z, x, y, mode=mode)
        return Response(content=png_bytes, media_type="image/png")
    except Exception as error:
        raise HTTPException(status_code=500, detail="Tile rendering failed") from error


@router.get("/analysis", response_model=dict[str, Any], summary="Regional terrain flood susceptibility analysis query")
async def terrain_analysis(
    region: str = Query("india", min_length=2, max_length=64),
):
    """
    Returns multi-resolution regional terrain susceptibility analysis metadata.
    """
    return {
        "region": region,
        "status": "ready",
        "resolution_m": 450 if region == "india" else 90,
        "metadata_url": "/api/v1/terrain/susceptibility?region=" + region,
        "tile_template_url": "/api/v1/terrain/tiles/{z}/{x}/{y}.png",
    }


@router.get("/india-baseline", response_model=dict[str, Any], summary="HydroSHEDS 15s India-wide terrain flood susceptibility baseline")
async def india_baseline(
    grid_resolution_deg: float = Query(0.25, ge=0.05, le=1.0),
    min_susceptibility: float = Query(0.0, ge=0.0, le=1.0),
):
    try:
        return generate_india_terrain_baseline(
            grid_resolution_deg=grid_resolution_deg,
            min_susceptibility=min_susceptibility,
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail="India terrain baseline analysis failed") from error


@router.get("/india-hotspots", response_model=dict[str, Any], summary="India-wide IMERG rainfall-forced flood hotspots")
async def india_hotspots(
    grid_resolution_deg: float = Query(0.25, ge=0.05, le=1.0),
    terrain_weight: float = Query(0.70, ge=0.0, le=1.0),
    rainfall_weight: float = Query(0.30, ge=0.0, le=1.0),
):
    if abs((terrain_weight + rainfall_weight) - 1.0) > 0.05:
        raise HTTPException(status_code=422, detail="terrain_weight and rainfall_weight must sum to 1.0")

    try:
        return generate_india_flood_hotspots(
            grid_resolution_deg=grid_resolution_deg,
            terrain_weight=terrain_weight,
            rainfall_weight=rainfall_weight,
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail="India flood hotspots analysis failed") from error
