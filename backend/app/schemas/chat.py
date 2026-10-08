from pydantic import BaseModel
from typing import List, Optional


class ChatMessage(BaseModel):
    role: str  # user, assistant, system
    content: str


class ChatRequest(BaseModel):
    message: str
    zone_id: Optional[str] = None
    conversation_history: Optional[List[ChatMessage]] = []


class ChatResponse(BaseModel):
    reply: str
    suggested_actions: List[str] = []
    referenced_zones: List[str] = []
