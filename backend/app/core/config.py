from pydantic_settings import BaseSettings
from typing import List, Union
from pydantic import field_validator
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "FloodShield AI Backend"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database Configuration (PostgreSQL with SQLite fallback for offline dev)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/floodshield"
    SQLITE_FALLBACK_URL: str = "sqlite:///./floodshield.db"

    # CORS Origins
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    # External APIs / LLM keys
    OPENWEATHER_API_KEY: str = ""
    INDIA_MET_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    AI_MODEL_PROVIDER: str = "simulation"

    # SMS Gateway (TextBee API)
    TEXTBEE_API_KEY: str = ""
    TEXTBEE_DEVICE_ID: str = "6ac7d5062597187c9cfc5f46"
    TEXTBEE_BASE_URL: str = "https://api.textbee.dev/api/v1/gateway/send-bulk-sms"

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()
