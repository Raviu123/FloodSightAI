from fastapi import APIRouter
from app.core.config import settings
from datetime import datetime

router = APIRouter()


@router.get("/health", summary="Health Check")
def health_check():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
