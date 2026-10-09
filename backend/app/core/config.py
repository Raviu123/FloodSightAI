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

    # Elevation-only terrain analysis configuration.
    DEM_TILE_URL: str = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
    DEM_TILE_ZOOM: int = 14

    # Terrain Flood Susceptibility Model Engineering Weights (Configurable)
    TERRAIN_WEIGHT_FLOW_ACC: float = 0.40
    TERRAIN_WEIGHT_RELATIVE_ELEV: float = 0.30
    TERRAIN_WEIGHT_SLOPE: float = 0.15
    TERRAIN_WEIGHT_WATER_PROXIMITY: float = 0.10
    TERRAIN_WEIGHT_COASTAL_EXPOSURE: float = 0.05

    # Dataset Directories & Files
    HYDROSHEDS_DATA_DIR: str = os.getenv("HYDROSHEDS_DATA_DIR", "data/hydrosheds")
    IMERG_HDF5_FILE: str = os.getenv("IMERG_HDF5_FILE", "3B-MO.MS.MRG.3IMERG.20250901-S000000-E235959.09.V07B (2).HDF5")

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()
