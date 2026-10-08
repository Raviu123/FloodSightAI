from fastapi import APIRouter
from typing import List
from datetime import datetime
import uuid
from app.schemas.alert import EmergencyAlert, BroadcastRequest, BroadcastResponse

router = APIRouter()

MOCK_ALERTS: List[EmergencyAlert] = [
    EmergencyAlert(
        id="ALT-8901",
        zone_id="ZONE-01",
        zone_name="Mangalore Estuary Sector 4",
        severity="danger",
        title="High Tide and Heavy Inflow Flash Warning",
        message="Astronomical high tide peaking at +3.8m in 3h 30m. Lowland evacuation to Highland Relief Shelter #1 advised.",
        timestamp=datetime.utcnow().isoformat() + "Z",
        evacuation_recommended=True,
        recommended_shelter_ids=["FAC-02"],
    ),
    EmergencyAlert(
        id="ALT-8902",
        zone_id="ZONE-02",
        zone_name="Udupi Lowlands",
        severity="warning",
        title="Estuary Surge Advisory",
        message="Water levels rising near river mouth. Small craft and fishery operations suspended.",
        timestamp=datetime.utcnow().isoformat() + "Z",
        evacuation_recommended=False,
    ),
]


@router.get("/", response_model=List[EmergencyAlert], summary="Get Active Emergency Alerts")
def get_active_alerts():
    return MOCK_ALERTS


@router.post("/broadcast", response_model=BroadcastResponse, summary="Broadcast Emergency Alert")
def broadcast_alert(req: BroadcastRequest):
    return BroadcastResponse(
        status="broadcast_dispatched",
        broadcast_id=f"BC-{uuid.uuid4().hex[:8].upper()}",
        sent_timestamp=datetime.utcnow().isoformat() + "Z",
        recipient_count=len(req.zone_ids) * 4500,
        zones_notified=req.zone_ids,
    )
