from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.simulation import SimulationInput
from app.services.flood_engine import calculate_flood_simulation
from app.services.llm_service import llm_service
from app.core.database import get_db
from app.core.logging_config import logger

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

    impact = sitrep.get("impact_assessment", {})
    directives = sitrep.get("tactical_directives", [])
    
    # Extract affected facilities and roads from ranked zones
    facilities_count = sum(len(z.threatened_facilities) for z in sim_res.zones)
    roads_count = sum(len(z.submerged_roads) for z in sim_res.zones)

    logger.log_sitrep(
        headline=f"{sitrep.get('incident_name', 'COASTAL SHIELD')} - {sitrep.get('weather_condition', 'MONSOON')}",
        overall_threat=str(sim_res.overall_risk),
        pop_at_risk=impact.get("total_population_at_risk", 0),
        affected_roads_count=roads_count,
        threatened_facilities_count=facilities_count,
        directives_count=len(directives),
    )

    return sitrep

