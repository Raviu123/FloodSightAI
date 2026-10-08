from fastapi import APIRouter
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ai_decision import process_ai_query

router = APIRouter()


@router.post("/query", response_model=ChatResponse, summary="Query AI Flood Decision Assistant")
def chat_with_assistant(req: ChatRequest):
    """
    Handles natural language queries regarding flood danger, peak times, zone safety,
    and evacuation routing using Juve and Laya decision heuristics.
    """
    result = process_ai_query(req.message, req.zone_id)
    return ChatResponse(
        reply=result["reply"],
        suggested_actions=result["suggested_actions"],
        referenced_zones=result["referenced_zones"],
    )
