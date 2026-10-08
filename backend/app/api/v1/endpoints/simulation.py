import time
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from app.schemas.simulation import SimulationInput, SimulationResponse
from app.services.flood_engine import calculate_flood_simulation
from app.core.database import get_db
from app.core.logging_config import logger

router = APIRouter()


@router.post("/run", response_model=SimulationResponse, summary="Run AI Coastal Flood Simulation")
def run_simulation(params: SimulationInput, db: Session = Depends(get_db)):
    """
    Simulates flood inundation and computes ML predictions, XAI driver breakdowns,
    Juve priority rankings, and SMS alerts across monitored coastal zones.
    """
    t0 = time.perf_counter()
    result = calculate_flood_simulation(params, db=db)
    duration_ms = (time.perf_counter() - t0) * 1000

    # Extract clean summaries for command center log
    zones_summary = []
    for z in result.zones:
        top_driver = z.primary_drivers[0] if z.primary_drivers else None
        zones_summary.append({
            "zone_name": z.zone_name,
            "threat_level": z.threat_level,
            "water_depth": z.projected_depth_meters,
            "onset_time": z.onset_time_minutes,
            "peak_time": z.peak_time_minutes,
            "top_driver": top_driver.factor_name if top_driver else "N/A",
            "top_driver_pct": int(top_driver.contribution_pct) if top_driver else 0,
        })

    logger.log_simulation_run(
        tide=params.tide_level_meters,
        rainfall=params.rainfall_mm_per_hour,
        forecast_hours=params.forecast_hours,
        cyclone=params.cyclone_active,
        soil_saturation=params.soil_saturation or 0.75,
        overall_threat=str(result.overall_risk),
        pop_at_risk=result.total_population_at_risk,
        inundated_area=result.estimated_inundated_area_sq_km,
        zones_summary=zones_summary,
        exec_time_ms=duration_ms,
    )

    return result


@router.get("/quick-estimate", response_model=SimulationResponse, summary="Quick Estimate via Query Params")
def quick_estimate(
    tide: float = Query(2.4, ge=0.0, le=10.0, description="Tide level in meters"),
    rainfall: float = Query(65.0, ge=0.0, le=500.0, description="Rainfall in mm/hour"),
    hours: int = Query(6, ge=1, le=48, description="Forecast hours"),
    cyclone: bool = Query(False, description="Active cyclone factor"),
    db: Session = Depends(get_db),
):
    params = SimulationInput(
        tide_level_meters=tide,
        rainfall_mm_per_hour=rainfall,
        forecast_hours=hours,
        cyclone_active=cyclone,
    )
    return run_simulation(params, db=db)

