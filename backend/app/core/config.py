# app/core/config.py — fix ALLOWED_ORIGINS parsing
# Replace your current config.py with this
import os
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # App
    APP_NAME:    str  = "RTMudah"
    APP_ENV:     str  = "development"
    DEBUG:       bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://rtmudah:rtmudah_secret@localhost:5432/rtmudah_db"

    # Redis
    REDIS_URL:      str = "redis://localhost:6379/0"
    REDIS_PASSWORD: str = ""

    # Security
    SECRET_KEY:                  str = "dev-secret-key-change-in-production"
    JWT_SECRET_KEY:              str = "dev-jwt-secret-change-in-production"
    JWT_ALGORITHM:               str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS:   int = 30

    # CORS — accepts both formats:
    #   JSON array:        ["http://localhost:3000","http://localhost:8000"]
    #   Comma-separated:   http://localhost:3000,http://localhost:8000
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            # JSON array format: ["url1","url2"]
            if v.startswith("["):
                import json
                return json.loads(v)
            # Comma-separated format: url1,url2
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Fonnte
    FONNTE_TOKEN:    str = ""
    FONNTE_BASE_URL: str = "https://api.fonnte.com"

    # DigitalOcean Spaces
    DO_SPACES_KEY:      str = ""
    DO_SPACES_SECRET:   str = ""
    DO_SPACES_BUCKET:   str = "rtmudah-media"
    DO_SPACES_REGION:   str = "sgp1"
    DO_SPACES_ENDPOINT: str = "https://sgp1.digitaloceanspaces.com"

    GOOGLE_VISION_API_KEY: str = ""

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


settings = Settings()
