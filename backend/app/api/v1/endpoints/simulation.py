from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from app.schemas.simulation import SimulationInput, SimulationResponse
from app.services.flood_engine import calculate_flood_simulation
from app.core.database import get_db

router = APIRouter()


@router.post("/run", response_model=SimulationResponse, summary="Run AI Coastal Flood Simulation")
def run_simulation(params: SimulationInput, db: Session = Depends(get_db)):
    """
    Simulates flood inundation and computes ML predictions, XAI driver breakdowns,
    Juve priority rankings, and SMS alerts across monitored coastal zones.
    """
    return calculate_flood_simulation(params, db=db)


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
    return calculate_flood_simulation(params, db=db)
