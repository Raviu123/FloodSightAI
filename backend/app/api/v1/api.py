from fastapi import APIRouter
from app.api.v1.endpoints import health, simulation, zones, alerts, ai_assistant, decision, sitrep

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(simulation.router, prefix="/simulation", tags=["AI Simulation Engine"])
api_router.include_router(zones.router, prefix="/zones", tags=["Coastal Zones & Infrastructure"])
api_router.include_router(decision.router, prefix="/decision", tags=["Juve Decision Framework"])
api_router.include_router(sitrep.router, prefix="/sitrep", tags=["Automated SITREP Briefing"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts & Broadcast"])
api_router.include_router(ai_assistant.router, prefix="/assistant", tags=["AI Copilot"])
