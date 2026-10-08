# Re-export from unified app.db.models
from app.db.models.zone import Zone, CriticalFacility, AffectedRoad

__all__ = ["Zone", "CriticalFacility", "AffectedRoad"]
