import uuid
from fastapi import APIRouter
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    VoiceScriptRequest,
    VoiceScriptResponse,
)
from app.services.assistant_service import assistant_service
from app.services.assistant_tools import get_zone_telemetry

router = APIRouter()


@router.post("/chat", response_model=ChatResponse, summary="Conversational AI Disaster Copilot")
def chat_with_copilot(req: ChatRequest):
    """
    Multi-persona conversational AI copilot with deterministic grounded tool-calling.
    Provides verified inundation depths, road closures, and nearest relief shelters.
    """
    history_dicts = [{"role": m.role, "content": m.content} for m in (req.conversation_history or [])]
    result = assistant_service.answer_query(
        message=req.message,
        zone_id=req.zone_id,
        user_role=req.user_role or "civilian",
        history=history_dicts,
    )
    return ChatResponse(
        reply=result["reply"],
        threat_level=result["threat_level"],
        target_zone=result["target_zone"],
        grounded_facts=result["grounded_facts"],
        tools_invoked=result["tools_invoked"],
        suggested_actions=result.get("suggested_actions", ["Check Evacuation Corridor", "View Nearest Shelters", "Dial Emergency Helpline 112"]),
        referenced_zones=result.get("referenced_zones", [result["target_zone"]]),
    )


@router.post("/query", response_model=ChatResponse, summary="Query AI Flood Decision Assistant (Legacy / Quick)")
def query_legacy(req: ChatRequest):
    """
    Compatibility wrapper mapping to copilot service.
    """
    return chat_with_copilot(req)


@router.post("/voice-script", response_model=VoiceScriptResponse, summary="Generate Audio Siren & Broadcast Script")
def generate_voice_script(req: VoiceScriptRequest):
    """
    Synthesizes formatted emergency audio announcement text for sirens and civic loudspeakers.
    """
    telemetry = get_zone_telemetry(req.zone_id)
    zone_name = telemetry["zone_name"]
    depth = telemetry["projected_depth_meters"]
    onset = telemetry["onset_time_minutes"]
    threat = telemetry["threat_level"]

    if "CRITICAL" in threat or "HIGH" in threat:
        siren_hz = 950
        script = (
            f"ATTENTION RESIDENTS OF {zone_name.upper()}. THIS IS AN EMERGENCY FLOOD WARNING. "
            f"WATER LEVELS ARE ESTIMATED TO REACH {depth:.1f} METERS WITHIN {onset} MINUTES. "
            f"IMMEDIATELY EVACUATE LOW GROUND AND MOVE TO DESIGNATED HIGH-ELEVATION RELIEF CENTERS. "
            f"DO NOT ENTER FLOODED ROADS. DIAL ONE ONE TWO FOR EMERGENCY RESCUE."
        )
    else:
        siren_hz = 440
        script = (
            f"ATTENTION RESIDENTS OF {zone_name.upper()}. THIS IS A FLOOD ADVISORY BULLETIN. "
            f"COASTAL MONITORING INDICATES MINOR WATERLOGGING POSSIBLE IN LOW-LYING AREAS. "
            f"STAY ALERT AND MONITOR OFFICIAL DISASTER BROADCASTS."
        )

    return VoiceScriptResponse(
        zone_name=zone_name,
        threat_level=threat,
        audio_script=script,
        estimated_duration_seconds=int(len(script.split()) * 0.45),
        siren_frequency_hz=siren_hz,
        broadcast_id=f"VS-{uuid.uuid4().hex[:8].upper()}",
    )
