from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.simulation import SimulationInput
from app.services.flood_engine import calculate_flood_simulation
from app.services.llm_service import llm_service
from app.core.database import get_db

router = APIRouter()


@router.post("/generate", summary="Generate AI Situation Report (SITREP)")
def generate_sitrep(params: SimulationInput, db: Session = Depends(get_db)):
    """
    Generates a formal tactical Situation Report (SITREP) formatted for NDRF commanders
    and District Disaster Management Authorities based on current simulation state.
    """
    sim_res = calculate_flood_simulation(params, db=db)
    
    ranked_dicts = [z.model_dump() for z in sim_res.zones]

    sitrep = llm_service.generate_sitrep_briefing(
        simulation_params=params.model_dump(),
        ranked_zones=ranked_dicts,
        total_population_at_risk=sim_res.total_population_at_risk,
        inundated_area_sq_km=sim_res.estimated_inundated_area_sq_km,
    )
    return sitrep
