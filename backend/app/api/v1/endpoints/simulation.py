from fastapi import APIRouter, Query
from app.schemas.simulation import SimulationInput, SimulationResponse
from app.services.flood_engine import calculate_flood_simulation

router = APIRouter()


@router.post("/run", response_model=SimulationResponse, summary="Run Coastal Flood Simulation")
def run_simulation(params: SimulationInput):
    """
    Simulates flood inundation across coastal zones with custom environmental parameters:
    - **tide_level_meters**: Tide level above MSL (0.0 to 10.0m)
    - **rainfall_mm_per_hour**: Rainfall intensity (0 to 500 mm/h)
    - **forecast_hours**: Prediction window (1 to 48 hours)
    - **wind_speed_kmh**: Wind speed in km/h
    - **cyclone_active**: Active storm surge factor
    """
    return calculate_flood_simulation(params)


@router.get("/quick-estimate", response_model=SimulationResponse, summary="Quick Estimate via Query Params")
def quick_estimate(
    tide: float = Query(2.4, ge=0.0, le=10.0, description="Tide level in meters"),
    rainfall: float = Query(65.0, ge=0.0, le=500.0, description="Rainfall in mm/hour"),
    hours: int = Query(6, ge=1, le=48, description="Forecast hours"),
):
    params = SimulationInput(
        tide_level_meters=tide,
        rainfall_mm_per_hour=rainfall,
        forecast_hours=hours,
    )
    return calculate_flood_simulation(params)
