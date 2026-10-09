from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict


class SMSMessagePayload(BaseModel):
    recipients: List[str] = Field(..., description="List of recipient phone numbers with country code, e.g. ['+14155550101']")
    message: str = Field(..., description="SMS text content to dispatch")


class SendSingleSMSRequest(BaseModel):
    recipient: str = Field(..., description="Recipient phone number, e.g. +919876543210 or +14155550101")
    message: str = Field(..., description="SMS body content")
    device_id: Optional[str] = Field(None, description="Optional override for TextBee deviceId")


class SendBulkSMSRequest(BaseModel):
    messages: List[SMSMessagePayload] = Field(..., description="List of message groups to dispatch")
    device_id: Optional[str] = Field(None, description="Optional override for TextBee deviceId")


class BroadcastSMSRequest(BaseModel):
    recipients: List[str] = Field(..., description="List of recipient phone numbers to receive the broadcast message")
    message: str = Field(..., description="SMS message to deliver to all recipients")
    device_id: Optional[str] = Field(None, description="Optional override for TextBee deviceId")


class SMSDispatchResponse(BaseModel):
    success: bool
    status_code: int
    message: str
    dispatched_count: int
    simulated: bool = False
    data: Optional[Dict[str, Any]] = None


class SMSGatewayStatus(BaseModel):
    configured: bool
    device_id: str
    api_key_configured: bool
    mode: str
    gateway_url: str


class ZonePhoneSubscriptionRequest(BaseModel):
    phone_number: str = Field(..., description="Phone number with country code, e.g. +919876543210 or +14155550101")
    zone_id: Optional[str] = Field(None, description="Target Zone ID, e.g. ZONE-01")
    zone_name: Optional[str] = Field(None, description="Target Zone Name (if zone_id is not specified or for cross-referencing)")
    name: Optional[str] = Field(None, description="Optional subscriber/resident contact name")


class ZoneSubscriptionItem(BaseModel):
    id: Optional[int] = None
    phone_number: str
    zone_id: str
    zone_name: str
    name: Optional[str] = None
    is_active: bool = True
    subscribed_at: str


class ZoneSubscriptionResponse(BaseModel):
    success: bool
    message: str
    subscription: Optional[ZoneSubscriptionItem] = None


class ZoneSubscriptionListResponse(BaseModel):
    total_count: int
    zone_id: Optional[str] = None
    subscriptions: List[ZoneSubscriptionItem]


class AutoCriticalAlertNotification(BaseModel):
    zone_id: str
    zone_name: str
    recipients_notified: List[str]
    recipients_count: int
    sms_text: str
    dispatch_success: bool
    simulated: bool
    timestamp: str


class SMSLogItem(BaseModel):
    id: Optional[int] = None
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    recipient: str
    message: str
    status: str
    status_code: Optional[int] = None
    gateway: str = "textbee"
    gateway_batch_id: Optional[str] = None
    simulated: bool = False
    error_details: Optional[str] = None
    created_at: str


class SMSLogListResponse(BaseModel):
    total_count: int
    zone_id: Optional[str] = None
    logs: List[SMSLogItem]
