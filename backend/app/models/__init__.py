# Re-export from unified app.db.models
from app.db.models import (
    Zone,
    CriticalFacility,
    AffectedRoad,
    PredictionRecord,
    AlertRecord,
    ConnectionTest,
)

__all__ = [
    "Zone",
    "CriticalFacility",
    "AffectedRoad",
    "PredictionRecord",
    "AlertRecord",
    "ConnectionTest",
]
