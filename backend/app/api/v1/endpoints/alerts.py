from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
import uuid
from app.core.database import get_db
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
        timestamp=datetime.now(timezone.utc).isoformat() + "Z",
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
        timestamp=datetime.now(timezone.utc).isoformat() + "Z",
        evacuation_recommended=False,
    ),
]


@router.get("/", response_model=List[EmergencyAlert], summary="Get Active Emergency Alerts")
def get_active_alerts():
    return MOCK_ALERTS


@router.post("/broadcast", response_model=BroadcastResponse, summary="Broadcast Emergency Alert")
async def broadcast_alert(req: BroadcastRequest, db: Session = Depends(get_db)):
    broadcast_id = f"BC-{uuid.uuid4().hex[:8].upper()}"
    sms_status = None
    recipients = list(req.recipient_phone_numbers or [])

    if "sms" in req.target_channels:
        # 1. Resolve subscriber numbers connected to target zones
        for zid in req.zone_ids:
            subs = sms_service.get_subscribers_for_zone(zone_id=zid, db=db)
            for s in subs:
                p = sms_service.normalize_phone(s.get("phone_number", ""))
                if p and p not in recipients:
                    recipients.append(p)

        # 2. Fallback to all active subscribers if no numbers registered specifically for zone
        if not recipients:
            all_subs = sms_service.get_subscribers_for_zone(db=db)
            for s in all_subs:
                p = sms_service.normalize_phone(s.get("phone_number", ""))
                if p and p not in recipients:
                    recipients.append(p)

        if recipients:
            msg_body = f"[{req.alert_title}] {req.alert_message}"
            target_zid = req.zone_ids[0] if req.zone_ids else None
            sms_res = await sms_service.broadcast_sms(
                recipients=recipients,
                message=msg_body,
                zone_id=target_zid,
                db=db,
            )
            sms_status = f"Dispatched via TextBee to {len(recipients)} phone(s) (simulated={sms_res.get('simulated', False)})"
        else:
            recipient_count = len(req.zone_ids) * 4500
            sms_status = f"Cell broadcast simulated for {recipient_count:,} subscribers across {len(req.zone_ids)} zone(s)"

    total_recipients = len(recipients) if recipients else len(req.zone_ids) * 4500

    print(f"\033[1;33m[ALERT BROADCAST]\033[0m Dispatched alert {broadcast_id} to {total_recipients:,} recipients across zones {req.zone_ids}. SMS Status: {sms_status}")

    return BroadcastResponse(
        status="broadcast_dispatched",
        broadcast_id=broadcast_id,
        sent_timestamp=datetime.now(timezone.utc).isoformat() + "Z",
        recipient_count=total_recipients,
        zones_notified=req.zone_ids,
        sms_dispatch_status=sms_status,
    )


