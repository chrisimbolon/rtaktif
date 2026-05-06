from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    APP_NAME: str = "RukunRT"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "dev-secret"
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://rukunrt:rukunrt_secret@db:5432/rukunrt_db"
    POSTGRES_USER: str = "rukunrt"
    POSTGRES_PASSWORD: str = "rukunrt_secret"
    POSTGRES_DB: str = "rukunrt_db"

    # Redis
    REDIS_URL: str = "redis://:redis_secret@redis:6379/0"
    REDIS_PASSWORD: str = "redis_secret"

    # JWT
    JWT_SECRET_KEY: str = "dev-jwt-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # DigitalOcean Spaces
    DO_SPACES_KEY: str = ""
    DO_SPACES_SECRET: str = ""
    DO_SPACES_BUCKET: str = "rukunrt-media"
    DO_SPACES_REGION: str = "sgp1"
    DO_SPACES_ENDPOINT: str = "https://sgp1.digitaloceanspaces.com"

    # Fonnte WhatsApp
    FONNTE_TOKEN: str = ""
    FONNTE_BASE_URL: str = "https://api.fonnte.com"

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()
