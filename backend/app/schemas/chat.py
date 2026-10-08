from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any, Union


class ChatMessage(BaseModel):
    role: str = "user"  # user, assistant, system
    content: str = ""

    @model_validator(mode="before")
    @classmethod
    def parse_flexible_message(cls, data: Any):
        if isinstance(data, str):
            return {"role": "user", "content": data}
        elif isinstance(data, dict):
            return {
                "role": data.get("role", data.get("sender", "user")),
                "content": data.get("content", data.get("message", data.get("text", ""))),
            }
        return data


class ChatRequest(BaseModel):
    message: str = Field(default="", description="User input text query or prompt")
    zone_id: Optional[str] = Field(default="ZONE-01", description="Target zone identifier")
    user_role: Optional[str] = Field(default="civilian", description="civilian | commander | engineer")
    conversation_history: Optional[List[ChatMessage]] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def harmonize_inputs(cls, data: Any):
        if not isinstance(data, dict):
            return {"message": str(data)}
        
        # Accept alternative keys for message: query, prompt, text, question
        msg = data.get("message") or data.get("query") or data.get("prompt") or data.get("text") or data.get("question") or ""
        
        # Accept alternative keys for zone: zone, zone_id, zoneId
        zone = data.get("zone_id") or data.get("zoneId") or data.get("zone") or "ZONE-01"
        
        # Accept alternative keys for role: role, user_role, userRole
        role = data.get("user_role") or data.get("userRole") or data.get("role") or "civilian"
        
        # Accept alternative keys for history: history, conversation_history, conversationHistory
        raw_hist = data.get("conversation_history") or data.get("conversationHistory") or data.get("history") or []
        parsed_hist = []
        for h in raw_hist:
            if isinstance(h, str):
                parsed_hist.append({"role": "user", "content": h})
            elif isinstance(h, dict):
                parsed_hist.append({
                    "role": h.get("role", h.get("sender", "user")),
                    "content": h.get("content", h.get("message", h.get("text", ""))),
                })

        return {
            "message": str(msg).strip(),
            "zone_id": str(zone).strip(),
            "user_role": str(role).strip(),
            "conversation_history": parsed_hist,
        }


class ChatResponse(BaseModel):
    reply: str
    threat_level: str = "LOW"
    target_zone: str = "ZONE-01"
    grounded_facts: Optional[Dict[str, Any]] = None
    tools_invoked: List[str] = Field(default_factory=list)
    suggested_actions: List[str] = Field(default_factory=list)
    referenced_zones: List[str] = Field(default_factory=list)


class VoiceScriptRequest(BaseModel):
    zone_id: Optional[str] = Field(default="ZONE-01")
    language: Optional[str] = "en"
    include_siren_cue: Optional[bool] = True

    @model_validator(mode="before")
    @classmethod
    def harmonize_voice_inputs(cls, data: Any):
        if not isinstance(data, dict):
            return {"zone_id": str(data)}
        zone = data.get("zone_id") or data.get("zoneId") or data.get("zone") or "ZONE-01"
        return {
            "zone_id": str(zone),
            "language": data.get("language", "en"),
            "include_siren_cue": data.get("include_siren_cue", True),
        }


class VoiceScriptResponse(BaseModel):
    zone_name: str
    threat_level: str
    audio_script: str
    estimated_duration_seconds: int
    siren_frequency_hz: int
    broadcast_id: str
