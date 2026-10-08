from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class AlertSeverity(str):
    INFO = "info"
    WARNING = "warning"
    DANGER = "danger"
    CRITICAL = "critical"


class EmergencyAlert(BaseModel):
    id: str
    zone_id: str
    zone_name: str
    severity: str
    title: str
    message: str
    timestamp: str
    evacuation_recommended: bool
    recommended_shelter_ids: List[str] = []


class BroadcastRequest(BaseModel):
    zone_ids: List[str]
    alert_title: str
    alert_message: str
    target_channels: List[str] = ["sms", "push_notification", "siren"]


class BroadcastResponse(BaseModel):
    status: str
    broadcast_id: str
    sent_timestamp: str
    recipient_count: int
    zones_notified: List[str]
