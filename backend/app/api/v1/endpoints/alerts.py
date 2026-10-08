from fastapi import APIRouter
from typing import List
from datetime import datetime
import uuid
from app.schemas.alert import EmergencyAlert, BroadcastRequest, BroadcastResponse
from app.services.sms_service import sms_service

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
async def broadcast_alert(req: BroadcastRequest):
    recipient_count = len(req.zone_ids) * 4500
    broadcast_id = f"BC-{uuid.uuid4().hex[:8].upper()}"
    sms_status = None

    if "sms" in req.target_channels:
        if req.recipient_phone_numbers:
            # Send targeted SMS messages to the specified recipients
            sms_res = await sms_service.broadcast_sms(
                recipients=req.recipient_phone_numbers,
                message=f"[{req.alert_title}] {req.alert_message}",
            )
            sms_status = f"Dispatched via TextBee to {len(req.recipient_phone_numbers)} phone(s) (simulated={sms_res.get('simulated', False)})"
        else:
            # Cell broadcast simulation
            sms_status = f"Cell broadcast simulated for {recipient_count:,} telecom subscribers across {len(req.zone_ids)} zone(s)"

    print(f"\033[1;33m[ALERT BROADCAST]\033[0m Dispatched alert {broadcast_id} to {recipient_count:,} residents across zones {req.zone_ids}. SMS Status: {sms_status}")

    return BroadcastResponse(
        status="broadcast_dispatched",
        broadcast_id=broadcast_id,
        sent_timestamp=datetime.utcnow().isoformat() + "Z",
        recipient_count=recipient_count,
        zones_notified=req.zone_ids,
        sms_dispatch_status=sms_status,
    )

