from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.simulation import SimulationInput
from app.services.flood_engine import calculate_flood_simulation
from app.core.database import get_db

router = APIRouter()


@router.post("/priority-queue", summary="Get Juve Emergency Response Priority Queue")
def get_priority_queue(params: SimulationInput, db: Session = Depends(get_db)):
    """
    Returns zones ranked by emergency priority score (Juve Multi-Criteria Decision Framework)
    taking into account inundation depth, vulnerable populations, hospital cut-off threats, and onset speed.
    """
    sim_res = calculate_flood_simulation(params, db=db)
    
    queue = []
    for z in sim_res.zones:
        queue.append({
            "rank": z.evacuation_priority_rank,
            "zone_id": z.zone_id,
            "zone_name": z.zone_name,
            "state": z.state,
            "threat_level": z.threat_level,
            "priority_score": z.priority_score,
            "projected_depth_meters": z.projected_depth_meters,
            "onset_time_minutes": z.onset_time_minutes,
            "peak_time_minutes": z.peak_time_minutes,
            "affected_population": z.population if z.is_flooded else 0,
            "threatened_facilities": [f.model_dump() for f in z.threatened_facilities],
            "safe_shelters": [s.model_dump() for s in z.safe_shelters],
            "submerged_roads": [r.model_dump() for r in z.submerged_roads],
            "recommended_action": z.recommended_action,
            "sms_alert": z.sms_text,
        })
    
    return {
        "total_zones": len(queue),
        "overall_threat": sim_res.overall_risk,
        "priority_queue": queue,
    }
