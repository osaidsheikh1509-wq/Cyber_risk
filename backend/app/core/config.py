from functools import lru_cache
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"


import os

def get_default_database_url() -> str:
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return "sqlite:////tmp/cyber_risk.db"
    return "sqlite:///./cyber_risk.db"


class Settings(BaseSettings):
    APP_NAME: str = "Cyber Risk Tracker API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "127.0.0.1"

    DATABASE_URL: str = get_default_database_url()
    DB_BACKEND: str = "sqlite"  # "sqlite" or "mongo"
    DB_FALLBACK: bool = False   # If True, fall back to SQLite when Mongo connection fails
    MONGODB_URI: str | None = None
    MONGODB_DB: str = "cyber_risk_tracker"
    SECRET_KEY: str = "cyber-risk-tracker-dev-insecure-secret-key-change-me"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,*"

    SARVAM_API_KEY: str | None = None
    SARVAM_BASE_URL: str = "https://api.sarvam.ai"
    MODEL_BACKEND: str = "mock"  # "mock", "sarvam", or "ollama"
    MODEL_URL: str = "http://localhost:11434"
    MODEL_NAME: str = "cyber-risk"

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH) if ENV_PATH.exists() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def sanitize_mongodb_uri(uri: str | None) -> str:
    """Mask credentials in MongoDB connection URI to prevent secret leakage in logs."""
    if not uri:
        return ""
    import re
    # Mask username and password in mongodb:// or mongodb+srv://
    return re.sub(r"://([^:@]+):([^@]+)@", r"://***:***@", uri)
