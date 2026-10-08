from fastapi import APIRouter
from app.api.v1.endpoints import health, simulation, zones, alerts, ai_assistant

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(simulation.router, prefix="/simulation", tags=["Simulation Engine"])
api_router.include_router(zones.router, prefix="/zones", tags=["Coastal Zones"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts & Evacuation"])
api_router.include_router(ai_assistant.router, prefix="/assistant", tags=["AI Assistant"])
