from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.services.elevation_safety import generate_elevation_safety

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
