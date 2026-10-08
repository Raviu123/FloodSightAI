from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.sms import (
    SendSingleSMSRequest,
    SendBulkSMSRequest,
    BroadcastSMSRequest,
    SMSDispatchResponse,
    SMSGatewayStatus,
    ZonePhoneSubscriptionRequest,
    ZoneSubscriptionResponse,
    ZoneSubscriptionListResponse,
    ZoneSubscriptionItem,
    SMSLogItem,
    SMSLogListResponse,
)
from app.services.sms_service import sms_service
from app.api.v1.endpoints.zones import resolve_zone_target

router = APIRouter()


@router.get("/status", response_model=SMSGatewayStatus, summary="Check TextBee SMS Gateway Status")
def get_sms_gateway_status():
    """
    Check the current configuration and readiness of the TextBee SMS Gateway.
    Returns whether the service is in live mode or simulation mode.
    """
    return SMSGatewayStatus(**sms_service.get_status())


@router.post("/send", response_model=SMSDispatchResponse, summary="Send Single SMS Message")
async def send_single_sms(req: SendSingleSMSRequest):
    """
    Send an individual SMS alert to a specific recipient phone number.
    """
    if not req.recipient or not req.recipient.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipient phone number cannot be empty.",
        )
    if not req.message or not req.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMS message body cannot be empty.",
        )

    result = await sms_service.send_sms(
        recipient=req.recipient.strip(),
        message=req.message.strip(),
        device_id=req.device_id,
    )
    return SMSDispatchResponse(**result)


@router.post("/bulk", response_model=SMSDispatchResponse, summary="Send Bulk SMS Batches")
async def send_bulk_sms(req: SendBulkSMSRequest):
    """
    Send bulk SMS messages with per-message recipient lists using TextBee gateway format:
    deviceId and list of {recipients: [...], message: '...'}
    """
    if not req.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The messages array cannot be empty.",
        )

    result = await sms_service.send_bulk_sms(
        messages=req.messages,
        device_id=req.device_id,
    )
    return SMSDispatchResponse(**result)


@router.post("/broadcast", response_model=SMSDispatchResponse, summary="Broadcast Single SMS Message to Multiple Numbers")
async def broadcast_sms(req: BroadcastSMSRequest):
    """
    Broadcast a single emergency message across a list of citizen phone numbers.
    """
    if not req.recipients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipients list cannot be empty.",
        )
    if not req.message or not req.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Broadcast message body cannot be empty.",
        )

    result = await sms_service.broadcast_sms(
        recipients=req.recipients,
        message=req.message.strip(),
        device_id=req.device_id,
    )
    return SMSDispatchResponse(**result)


@router.post("/subscribe-zone", response_model=ZoneSubscriptionResponse, summary="Connect Phone Number to Zone for Critical Auto-SMS Alerts")
def subscribe_phone_via_sms_gateway(req: ZonePhoneSubscriptionRequest, db: Session = Depends(get_db)):
    """
    Connects a phone number with a zone_id and zone_name.
    When the model classifies this zone as CRITICAL, an automated emergency SMS
    is dispatched immediately to this number.
    """
    if not req.phone_number or not req.phone_number.strip():
        raise HTTPException(status_code=400, detail="phone_number is required.")

    target_zone_id, target_zone_name = resolve_zone_target(db, zone_id=req.zone_id, zone_name=req.zone_name)
    sub = sms_service.register_zone_subscription(
        phone_number=req.phone_number,
        zone_id=target_zone_id,
        zone_name=target_zone_name,
        name=req.name,
        db=db,
    )
    return ZoneSubscriptionResponse(
        success=True,
        message=f"Phone number {sub['phone_number']} successfully connected to {target_zone_id} ({target_zone_name}). Automatic SMS alerts will trigger when this zone reaches CRITICAL.",
        subscription=ZoneSubscriptionItem(**sub),
    )


@router.get("/subscriptions", response_model=ZoneSubscriptionListResponse, summary="List All Active Zone Phone Subscriptions")
def list_sms_gateway_subscriptions(zone_id: str = None, db: Session = Depends(get_db)):
    """List all registered phone numbers connected to coastal zones for emergency alerts."""
    subscribers = sms_service.get_subscribers_for_zone(zone_id=zone_id, db=db)
    items = [ZoneSubscriptionItem(**s) for s in subscribers]
    return ZoneSubscriptionListResponse(
        total_count=len(items),
        zone_id=zone_id.upper() if zone_id else None,
        subscriptions=items,
    )


@router.get("/logs", response_model=SMSLogListResponse, summary="Get Historical SMS Dispatch Logs")
def get_all_sms_logs(
    zone_id: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Retrieve audit history of all SMS dispatches (single, bulk, broadcast, and auto-critical alerts),
    including status codes, batch IDs, recipient numbers, and simulated/live indicators.
    """
    logs = sms_service.get_sms_logs(zone_id=zone_id, limit=limit, db=db)
    items = [SMSLogItem(**l) for l in logs]
    return SMSLogListResponse(
        total_count=len(items),
        zone_id=zone_id.upper() if zone_id else None,
        logs=items,
    )


@router.get("/logs/{zone_id}", response_model=SMSLogListResponse, summary="Get SMS Logs for a Specific Zone")
def get_zone_sms_logs(
    zone_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Retrieve audit history of SMS alerts sent specifically for a given coastal zone."""
    logs = sms_service.get_sms_logs(zone_id=zone_id, limit=limit, db=db)
    items = [SMSLogItem(**l) for l in logs]
    return SMSLogListResponse(
        total_count=len(items),
        zone_id=zone_id.upper(),
        logs=items,
    )
