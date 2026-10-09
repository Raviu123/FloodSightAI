import logging
import os
from typing import List, Dict, Any, Optional, Union
from datetime import datetime, timezone
import httpx
import requests

from app.core.config import settings

logger = logging.getLogger("floodsight.sms")


class SMSService:
    """
    SMS Connector for TextBee Gateway API.
    Provides both asynchronous (httpx) and synchronous (requests) methods
    to dispatch individual, bulk, and broadcast SMS messages,
    plus automatic critical-zone subscriber alerting and SMS dispatch logging.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        device_id: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self._api_key = api_key
        self._device_id = device_id
        self._base_url = base_url or settings.TEXTBEE_BASE_URL
        self._in_memory_subscriptions: Dict[str, Dict[str, Any]] = {
            "+919876543210_IXE-01": {
                "id": 1,
                "phone_number": "+919876543210",
                "zone_id": "IXE-01",
                "zone_name": "Bengre Sand Spit & Alive Sagara",
                "name": "Captain R. Sharma (Incident Response Lead)",
                "is_active": True,
                "subscribed_at": "2026-10-09T00:00:00Z",
            },
            "+919812345678_IXE-01": {
                "id": 2,
                "phone_number": "+919812345678",
                "zone_id": "IXE-01",
                "zone_name": "Bengre Sand Spit & Alive Sagara",
                "name": "Bengre Fisheries Clinic Supervisor",
                "is_active": True,
                "subscribed_at": "2026-10-09T00:00:00Z",
            },
            "+919898989898_IXE-02": {
                "id": 3,
                "phone_number": "+919898989898",
                "zone_id": "IXE-02",
                "zone_name": "Ullal Coastal Lowlands & Someshwar",
                "name": "Someshwar Coastal Relief Warden",
                "is_active": True,
                "subscribed_at": "2026-10-09T00:00:00Z",
            },
            "+919765432109_ZONE-03": {
                "id": 4,
                "phone_number": "+919765432109",
                "zone_id": "ZONE-03",
                "zone_name": "Kochi Backwaters & Canal Network",
                "name": "Ernakulam Disaster Control Desk",
                "is_active": True,
                "subscribed_at": "2026-10-09T00:00:00Z",
            },
        }
        self._in_memory_logs: List[Dict[str, Any]] = []

    @property
    def api_key(self) -> str:
        if self._api_key:
            return self._api_key
        key = settings.TEXTBEE_API_KEY or os.getenv("TEXTBEE_API_KEY", "")
        if not key:
            try:
                from dotenv import dotenv_values
                vals = dotenv_values(".env")
                key = vals.get("TEXTBEE_API_KEY", "")
            except Exception:
                pass
        return key.strip() if key else ""

    @property
    def device_id(self) -> str:
        if self._device_id:
            return self._device_id
        dev = settings.TEXTBEE_DEVICE_ID or os.getenv("TEXTBEE_DEVICE_ID", "")
        if not dev:
            try:
                from dotenv import dotenv_values
                vals = dotenv_values(".env")
                dev = vals.get("TEXTBEE_DEVICE_ID", "")
            except Exception:
                pass
        return (dev.strip() if dev else "") or "6ac7d5062597187c9cfc5f46"

    @property
    def base_url(self) -> str:
        return self._base_url or settings.TEXTBEE_BASE_URL

    def is_configured(self) -> bool:
        """Returns True if a non-empty API key is configured."""
        return bool(self.api_key and self.api_key.strip())

    def get_status(self) -> Dict[str, Any]:
        """Returns the gateway health and configuration status."""
        configured = self.is_configured()
        return {
            "configured": configured,
            "device_id": self.device_id,
            "api_key_configured": configured,
            "mode": "live" if configured else "simulation",
            "gateway_url": self.base_url,
        }

    @staticmethod
    def normalize_phone(phone_number: str) -> str:
        """
        Standardizes phone numbers with leading plus sign and country code.
        - Maps 10-digit Indian numbers (starting with 6,7,8,9) to +91 country code.
        - Automatically repairs +903... numbers created by legacy prefixing to +91.
        - Preserves valid existing international numbers with +.
        """
        cleaned = phone_number.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if not cleaned:
            return ""

        # Fix previous prefix issue where a 10-digit Indian number starting with 90 was turned into +90...
        if cleaned.startswith("+90") and len(cleaned) == 11 and cleaned[3] in "0123456789":
            cleaned = "+91" + cleaned[1:]

        if cleaned.startswith("+"):
            return cleaned

        # 10 digits starting with 6, 7, 8, 9 (Standard Indian mobile) -> +91
        if len(cleaned) == 10 and cleaned[0] in "6789":
            return f"+91{cleaned}"

        # 12 digits starting with 91 -> +91...
        if len(cleaned) == 12 and cleaned.startswith("91"):
            return f"+{cleaned}"

        # General international fallback
        return f"+{cleaned}"

    def _normalize_messages(
        self, messages: List[Union[Dict[str, Any], Any]]
    ) -> List[Dict[str, Any]]:
        """
        Normalizes messages into TextBee payload format:
        [
            {'recipients': ['+919876543210'], 'message': 'Alert message'},
            ...
        ]
        """
        normalized = []
        for msg in messages:
            if isinstance(msg, dict):
                recipients = msg.get("recipients", [])
                if isinstance(recipients, str):
                    recipients = [recipients]
                clean_recipients = [self.normalize_phone(r) for r in recipients if r]
                normalized.append({
                    "recipients": clean_recipients,
                    "message": str(msg.get("message", "")),
                })
            elif hasattr(msg, "recipients") and hasattr(msg, "message"):
                recipients = getattr(msg, "recipients")
                if isinstance(recipients, str):
                    recipients = [recipients]
                clean_recipients = [self.normalize_phone(r) for r in recipients if r]
                normalized.append({
                    "recipients": clean_recipients,
                    "message": str(getattr(msg, "message")),
                })
        return normalized

    # --------------------------------------------------------------------------
    # SMS Logging Management
    # --------------------------------------------------------------------------
    def record_sms_log(
        self,
        recipient: str,
        message: str,
        status: str,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        status_code: Optional[int] = None,
        gateway_batch_id: Optional[str] = None,
        simulated: bool = False,
        error_details: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Records an SMS dispatch attempt in the database and in-memory log buffer."""
        timestamp = datetime.now(timezone.utc).isoformat() + "Z"
        clean_recip = self.normalize_phone(recipient)
        log_entry = {
            "id": len(self._in_memory_logs) + 1,
            "zone_id": zone_id,
            "zone_name": zone_name,
            "recipient": clean_recip,
            "message": message,
            "status": status,
            "status_code": status_code,
            "gateway": "textbee",
            "gateway_batch_id": gateway_batch_id,
            "simulated": simulated,
            "error_details": error_details,
            "created_at": timestamp,
        }

        # Cache in memory
        self._in_memory_logs.insert(0, log_entry)
        if len(self._in_memory_logs) > 500:
            self._in_memory_logs.pop()

        # Persist to Database if possible
        try:
            from app.db.session import SessionLocal
            from app.models.sms_log import SMSLogRecord

            session = db or SessionLocal()
            try:
                rec = SMSLogRecord(
                    zone_id=zone_id,
                    zone_name=zone_name,
                    recipient=clean_recip,
                    message=message,
                    status=status,
                    status_code=status_code,
                    gateway="textbee",
                    gateway_batch_id=gateway_batch_id,
                    simulated=simulated,
                    error_details=error_details,
                )
                session.add(rec)
                session.commit()
                log_entry["id"] = rec.id
                if not db:
                    session.close()
            except Exception as e:
                logger.warning(f"Could not persist SMS log to DB ({e})")
                if session and hasattr(session, "rollback"):
                    session.rollback()
                if not db and session:
                    session.close()
        except Exception as e:
            logger.warning(f"Could not access DB session for SMS log ({e})")

        return log_entry

    def get_sms_logs(
        self,
        zone_id: Optional[str] = None,
        limit: int = 100,
        db: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieves SMS dispatch history ordered by most recent first."""
        db_logs: List[Dict[str, Any]] = []
        try:
            from app.db.session import SessionLocal
            from app.models.sms_log import SMSLogRecord

            session = db or SessionLocal()
            try:
                q = session.query(SMSLogRecord)
                if zone_id and zone_id.strip():
                    q = q.filter(SMSLogRecord.zone_id == zone_id.strip().upper())
                records = q.order_by(SMSLogRecord.id.desc()).limit(limit).all()
                for r in records:
                    db_logs.append({
                        "id": r.id,
                        "zone_id": r.zone_id,
                        "zone_name": r.zone_name,
                        "recipient": r.recipient,
                        "message": r.message,
                        "status": r.status,
                        "status_code": r.status_code,
                        "gateway": r.gateway,
                        "gateway_batch_id": r.gateway_batch_id,
                        "simulated": r.simulated,
                        "error_details": r.error_details,
                        "created_at": r.created_at.isoformat() + "Z" if r.created_at else datetime.now(timezone.utc).isoformat() + "Z",
                    })
                if not db:
                    session.close()
            except Exception as e:
                logger.warning(f"Error querying SMS logs from DB ({e})")
                if not db and session:
                    session.close()
        except Exception as e:
            logger.warning(f"Could not open session for SMS logs ({e})")

        if db_logs:
            return db_logs[:limit]

        # In-memory fallback
        filtered = self._in_memory_logs
        if zone_id and zone_id.strip():
            target = zone_id.strip().upper()
            filtered = [l for l in filtered if l.get("zone_id") == target]
        return filtered[:limit]

    # --------------------------------------------------------------------------
    # Synchronous Execution (using requests - matches TextBee template)
    # --------------------------------------------------------------------------
    def send_bulk_sms_sync(
        self,
        messages: List[Dict[str, Any]],
        device_id: Optional[str] = None,
        api_key: Optional[str] = None,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        timeout: int = 15,
        db: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Synchronously dispatches bulk SMS messages via TextBee Gateway and logs each message.
        """
        target_device_id = device_id or self.device_id
        target_api_key = api_key or self.api_key
        normalized_messages = self._normalize_messages(messages)
        total_recipients = sum(len(m.get("recipients", [])) for m in normalized_messages)

        # Simulation Mode fallback if API key not supplied
        if not target_api_key:
            logger.info(
                f"[SMS GATEWAY SIMULATION] TextBee API Key not configured. "
                f"Simulating delivery of {len(normalized_messages)} message batch(es) "
                f"to {total_recipients} recipient(s) via device {target_device_id}."
            )
            # Log each simulated dispatch
            for m in normalized_messages:
                for r in m.get("recipients", []):
                    self.record_sms_log(
                        recipient=r,
                        message=m.get("message", ""),
                        status="SIMULATED",
                        zone_id=zone_id,
                        zone_name=zone_name,
                        status_code=200,
                        simulated=True,
                        db=db,
                    )

            return {
                "success": True,
                "status_code": 200,
                "message": f"Simulation: Dispatched to {total_recipients} recipient(s).",
                "dispatched_count": total_recipients,
                "simulated": True,
                "data": {
                    "deviceId": target_device_id,
                    "messages_count": len(normalized_messages),
                    "recipients_count": total_recipients,
                },
            }

        payload = {
            "deviceId": target_device_id,
            "messages": normalized_messages,
        }
        headers = {
            "x-api-key": target_api_key,
            "Content-Type": "application/json",
        }

        try:
            logger.info(
                f"[SMS GATEWAY] Dispatching {len(normalized_messages)} message batch(es) "
                f"to {total_recipients} recipient(s) via TextBee device {target_device_id}."
            )
            response = requests.post(
                self.base_url,
                headers=headers,
                json=payload,
                timeout=timeout,
            )

            try:
                response_json = response.json()
            except Exception:
                response_json = {"raw": response.text}

            success = 200 <= response.status_code < 300
            batch_id = response_json.get("data", {}).get("smsBatchId") if isinstance(response_json, dict) else None
            log_status = "QUEUED" if success else "FAILED"
            err_msg = None if success else response.text

            # Log each recipient in database
            for m in normalized_messages:
                for r in m.get("recipients", []):
                    self.record_sms_log(
                        recipient=r,
                        message=m.get("message", ""),
                        status=log_status,
                        zone_id=zone_id,
                        zone_name=zone_name,
                        status_code=response.status_code,
                        gateway_batch_id=batch_id,
                        simulated=False,
                        error_details=err_msg,
                        db=db,
                    )

            return {
                "success": success,
                "status_code": response.status_code,
                "message": "SMS dispatched successfully." if success else f"Gateway error: {response.text}",
                "dispatched_count": total_recipients if success else 0,
                "simulated": False,
                "data": response_json,
            }

        except Exception as exc:
            logger.error(f"[SMS GATEWAY ERROR] Failed to send SMS via TextBee: {exc}", exc_info=True)
            for m in normalized_messages:
                for r in m.get("recipients", []):
                    self.record_sms_log(
                        recipient=r,
                        message=m.get("message", ""),
                        status="FAILED",
                        zone_id=zone_id,
                        zone_name=zone_name,
                        status_code=500,
                        simulated=False,
                        error_details=str(exc),
                        db=db,
                    )
            return {
                "success": False,
                "status_code": 500,
                "message": f"Failed to connect to TextBee SMS Gateway: {str(exc)}",
                "dispatched_count": 0,
                "simulated": False,
                "data": None,
            }

    def send_sms_sync(
        self,
        recipient: str,
        message: str,
        device_id: Optional[str] = None,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Synchronously sends a single SMS message."""
        clean_recip = self.normalize_phone(recipient)
        return self.send_bulk_sms_sync(
            messages=[{"recipients": [clean_recip], "message": message}],
            device_id=device_id,
            zone_id=zone_id,
            zone_name=zone_name,
            db=db,
        )

    def broadcast_sms_sync(
        self,
        recipients: List[str],
        message: str,
        device_id: Optional[str] = None,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Synchronously broadcasts the same SMS message to multiple recipients."""
        clean_recipients = [self.normalize_phone(r) for r in recipients if r]
        return self.send_bulk_sms_sync(
            messages=[{"recipients": clean_recipients, "message": message}],
            device_id=device_id,
            zone_id=zone_id,
            zone_name=zone_name,
            db=db,
        )

    # --------------------------------------------------------------------------
    # Asynchronous Execution (using httpx - ideal for non-blocking FastAPI)
    # --------------------------------------------------------------------------
    async def send_bulk_sms(
        self,
        messages: List[Dict[str, Any]],
        device_id: Optional[str] = None,
        api_key: Optional[str] = None,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        timeout: int = 15,
        db: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Asynchronously dispatches bulk SMS messages via TextBee Gateway.
        """
        target_device_id = device_id or self.device_id
        target_api_key = api_key or self.api_key
        normalized_messages = self._normalize_messages(messages)
        total_recipients = sum(len(m.get("recipients", [])) for m in normalized_messages)

        # Simulation Mode fallback if API key not supplied
        if not target_api_key:
            logger.info(
                f"[SMS GATEWAY SIMULATION] TextBee API Key not configured. "
                f"Simulating delivery of {len(normalized_messages)} message batch(es) "
                f"to {total_recipients} recipient(s) via device {target_device_id}."
            )
            for m in normalized_messages:
                for r in m.get("recipients", []):
                    self.record_sms_log(
                        recipient=r,
                        message=m.get("message", ""),
                        status="SIMULATED",
                        zone_id=zone_id,
                        zone_name=zone_name,
                        status_code=200,
                        simulated=True,
                        db=db,
                    )
            return {
                "success": True,
                "status_code": 200,
                "message": f"Simulation: Dispatched to {total_recipients} recipient(s).",
                "dispatched_count": total_recipients,
                "simulated": True,
                "data": {
                    "deviceId": target_device_id,
                    "messages_count": len(normalized_messages),
                    "recipients_count": total_recipients,
                },
            }

        payload = {
            "deviceId": target_device_id,
            "messages": normalized_messages,
        }
        headers = {
            "x-api-key": target_api_key,
            "Content-Type": "application/json",
        }

        try:
            logger.info(
                f"[SMS GATEWAY] Dispatching {len(normalized_messages)} message batch(es) "
                f"to {total_recipients} recipient(s) via TextBee device {target_device_id}."
            )
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                )

            try:
                response_json = response.json()
            except Exception:
                response_json = {"raw": response.text}

            success = 200 <= response.status_code < 300
            batch_id = response_json.get("data", {}).get("smsBatchId") if isinstance(response_json, dict) else None
            log_status = "QUEUED" if success else "FAILED"
            err_msg = None if success else response.text

            for m in normalized_messages:
                for r in m.get("recipients", []):
                    self.record_sms_log(
                        recipient=r,
                        message=m.get("message", ""),
                        status=log_status,
                        zone_id=zone_id,
                        zone_name=zone_name,
                        status_code=response.status_code,
                        gateway_batch_id=batch_id,
                        simulated=False,
                        error_details=err_msg,
                        db=db,
                    )

            return {
                "success": success,
                "status_code": response.status_code,
                "message": "SMS dispatched successfully." if success else f"Gateway error: {response.text}",
                "dispatched_count": total_recipients if success else 0,
                "simulated": False,
                "data": response_json,
            }

        except Exception as exc:
            logger.error(f"[SMS GATEWAY ERROR] Failed to send SMS via TextBee: {exc}", exc_info=True)
            for m in normalized_messages:
                for r in m.get("recipients", []):
                    self.record_sms_log(
                        recipient=r,
                        message=m.get("message", ""),
                        status="FAILED",
                        zone_id=zone_id,
                        zone_name=zone_name,
                        status_code=500,
                        simulated=False,
                        error_details=str(exc),
                        db=db,
                    )
            return {
                "success": False,
                "status_code": 500,
                "message": f"Failed to connect to TextBee SMS Gateway: {str(exc)}",
                "dispatched_count": 0,
                "simulated": False,
                "data": None,
            }

    async def send_sms(
        self,
        recipient: str,
        message: str,
        device_id: Optional[str] = None,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Asynchronously sends a single SMS message."""
        clean_recip = self.normalize_phone(recipient)
        return await self.send_bulk_sms(
            messages=[{"recipients": [clean_recip], "message": message}],
            device_id=device_id,
            zone_id=zone_id,
            zone_name=zone_name,
            db=db,
        )

    async def broadcast_sms(
        self,
        recipients: List[str],
        message: str,
        device_id: Optional[str] = None,
        zone_id: Optional[str] = None,
        zone_name: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Asynchronously broadcasts the same SMS message to multiple recipients."""
        clean_recipients = [self.normalize_phone(r) for r in recipients if r]
        return await self.send_bulk_sms(
            messages=[{"recipients": clean_recipients, "message": message}],
            device_id=device_id,
            zone_id=zone_id,
            zone_name=zone_name,
            db=db,
        )

    # --------------------------------------------------------------------------
    # Zone Phone Subscription & Critical Alert Management
    # --------------------------------------------------------------------------
    def register_zone_subscription(
        self,
        phone_number: str,
        zone_id: str,
        zone_name: str,
        name: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Connects a phone number with a zone_id and zone_name so that automated SMS
        alerts are dispatched to this phone number whenever the model detects the
        zone as CRITICAL.
        Persists to the database when available and caches in-memory for resilience.
        """
        clean_phone = self.normalize_phone(phone_number)
        clean_zone_id = zone_id.strip().upper()
        clean_zone_name = zone_name.strip()
        timestamp = datetime.now(timezone.utc).isoformat() + "Z"
        sub_id = None

        if db is not None:
            try:
                from app.models.zone import ZoneSubscriber
                existing = db.query(ZoneSubscriber).filter(
                    ZoneSubscriber.phone_number == clean_phone,
                    ZoneSubscriber.zone_id == clean_zone_id,
                ).first()
                if existing:
                    existing.is_active = True
                    existing.zone_name = clean_zone_name
                    if name:
                        existing.name = name
                    db.commit()
                    db.refresh(existing)
                    sub_id = existing.id
                else:
                    new_sub = ZoneSubscriber(
                        phone_number=clean_phone,
                        zone_id=clean_zone_id,
                        zone_name=clean_zone_name,
                        name=name,
                        is_active=True,
                    )
                    db.add(new_sub)
                    db.commit()
                    db.refresh(new_sub)
                    sub_id = new_sub.id
            except Exception as e:
                logger.warning(f"Could not persist ZoneSubscriber to DB ({e}), falling back to in-memory store.")
                if hasattr(db, "rollback"):
                    db.rollback()

        # Cache in memory
        key = f"{clean_phone}_{clean_zone_id}"
        record = {
            "id": sub_id or len(self._in_memory_subscriptions) + 1,
            "phone_number": clean_phone,
            "zone_id": clean_zone_id,
            "zone_name": clean_zone_name,
            "name": name,
            "is_active": True,
            "subscribed_at": timestamp,
        }
        self._in_memory_subscriptions[key] = record

        logger.info(
            f"[ZONE SMS SUBSCRIPTION] Connected phone {clean_phone} to {clean_zone_id} ({clean_zone_name})."
        )
        return record

    def get_subscribers_for_zone(
        self,
        zone_id: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all active subscribers for a specific zone or across all zones.
        """
        subs: Dict[str, Dict[str, Any]] = {}

        # 1. Fetch from Database if available
        if db is not None:
            try:
                from app.models.zone import ZoneSubscriber
                query = db.query(ZoneSubscriber).filter(ZoneSubscriber.is_active == True)
                if zone_id:
                    query = query.filter(ZoneSubscriber.zone_id == zone_id.strip().upper())
                records = query.all()
                for r in records:
                    clean_p = self.normalize_phone(r.phone_number)
                    k = f"{clean_p}_{r.zone_id}"
                    subs[k] = {
                        "id": r.id,
                        "phone_number": clean_p,
                        "zone_id": r.zone_id,
                        "zone_name": r.zone_name,
                        "name": r.name,
                        "is_active": r.is_active,
                        "subscribed_at": r.subscribed_at.isoformat() + "Z" if r.subscribed_at else datetime.now(timezone.utc).isoformat() + "Z",
                    }
            except Exception as e:
                logger.warning(f"Error querying subscribers from DB ({e}). Falling back to memory store.")

        # 2. Merge with in-memory subscriptions
        target_zone_id = zone_id.strip().upper() if zone_id else None
        for k, v in self._in_memory_subscriptions.items():
            if not v.get("is_active", True):
                continue
            if target_zone_id and v.get("zone_id") != target_zone_id:
                continue
            clean_p = self.normalize_phone(v.get("phone_number", ""))
            k_clean = f"{clean_p}_{v.get('zone_id')}"
            if k_clean not in subs:
                v_copy = dict(v)
                v_copy["phone_number"] = clean_p
                subs[k_clean] = v_copy

        return list(subs.values())

    def remove_zone_subscription(
        self,
        phone_number: str,
        zone_id: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> bool:
        """Unsubscribes / deactivates a phone number from a zone."""
        clean_phone = self.normalize_phone(phone_number)
        clean_zone = zone_id.strip().upper() if zone_id else None

        if db is not None:
            try:
                from app.models.zone import ZoneSubscriber
                # Also match phone without leading + in DB if legacy
                raw_phone = clean_phone.lstrip("+")
                query = db.query(ZoneSubscriber).filter(
                    (ZoneSubscriber.phone_number == clean_phone) |
                    (ZoneSubscriber.phone_number == raw_phone) |
                    (ZoneSubscriber.phone_number == f"+90{clean_phone[3:]}" if clean_phone.startswith("+91") else False)
                )
                if clean_zone:
                    query = query.filter(ZoneSubscriber.zone_id == clean_zone)
                targets = query.all()
                for t in targets:
                    t.is_active = False
                db.commit()
            except Exception as e:
                logger.warning(f"Error updating DB for unsubscribe ({e})")
                if hasattr(db, "rollback"):
                    db.rollback()

        removed = False
        keys_to_del = []
        for k, v in self._in_memory_subscriptions.items():
            stored_p = self.normalize_phone(v["phone_number"])
            if stored_p == clean_phone:
                if not clean_zone or v["zone_id"] == clean_zone:
                    keys_to_del.append(k)
                    removed = True
        for k in keys_to_del:
            self._in_memory_subscriptions.pop(k, None)

        return removed

    def dispatch_critical_zone_alert(
        self,
        zone_id: str,
        zone_name: str,
        projected_depth_m: float,
        onset_min: int,
        peak_min: int,
        sms_text: Optional[str] = None,
        db: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Triggers an automated emergency SMS alert to all registered phone numbers
        connected to this critical zone, and logs the dispatch.
        """
        subscribers = self.get_subscribers_for_zone(zone_id=zone_id, db=db)
        if not subscribers:
            logger.info(
                f"[CRITICAL ZONE CHECK] Zone {zone_id} ({zone_name}) classified as CRITICAL, but no phone numbers are connected."
            )
            return None

        phone_numbers = [self.normalize_phone(s["phone_number"]) for s in subscribers if s.get("phone_number")]
        if not phone_numbers:
            return None

        message = (
            sms_text
            if sms_text and sms_text.strip()
            else f"EMERGENCY CRITICAL WARNING: {zone_name} flood depth {projected_depth_m:.2f}m. Onset in {onset_min}m, peak in {peak_min}m. Move to safe high ground immediately! Dial 112 for NDRF rescue."
        )

        logger.warning(
            f"\033[1;31m[CRITICAL ZONE AUTO-SMS]\033[0m Zone {zone_id} ({zone_name}) reached CRITICAL! "
            f"Auto-dispatching emergency SMS to {len(phone_numbers)} connected phone number(s): {phone_numbers}"
        )

        dispatch_res = self.send_bulk_sms_sync(
            messages=[{"recipients": phone_numbers, "message": message}],
            zone_id=zone_id,
            zone_name=zone_name,
            db=db,
        )

        # Log AlertRecord to database
        if db is not None:
            try:
                from app.models.alert import AlertRecord
                alert_rec = AlertRecord(
                    zone_id=zone_id,
                    severity="CRITICAL",
                    headline=f"Automated SMS Alert for {zone_name}",
                    message_body=message,
                    sms_text=message,
                    is_active=True,
                )
                db.add(alert_rec)
                db.commit()
            except Exception as e:
                logger.warning(f"Could not persist automated alert to DB: {e}")
                if hasattr(db, "rollback"):
                    db.rollback()

        return {
            "zone_id": zone_id,
            "zone_name": zone_name,
            "recipients_notified": phone_numbers,
            "recipients_count": len(phone_numbers),
            "sms_text": message,
            "dispatch_success": dispatch_res.get("success", False),
            "simulated": dispatch_res.get("simulated", False),
            "gateway_data": dispatch_res.get("data"),
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }


# Global singleton instance
sms_service = SMSService()
