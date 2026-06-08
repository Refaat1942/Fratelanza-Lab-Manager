from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

WEAK_SECRET_KEYS = {
    "change-me-in-production",
    "change-me-in-production-use-openssl-rand-hex-32",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "LabMaster Egypt API"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    DATABASE_URL: str = "postgresql+asyncpg://labmaster:labmaster@localhost:5432/labmaster"
    DATABASE_URL_SYNC: str = "postgresql://labmaster:labmaster@localhost:5432/labmaster"

    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:13000",
        "https://labmaster.fratelanza.com",
        "http://labmaster.fratelanza.com",
    ]
    RATE_LIMIT: str = "100/minute"
    AUTH_LOGIN_RATE_LIMIT: str = "10/minute"
    AUTH_REFRESH_RATE_LIMIT: str = "30/minute"

    REDIS_URL: str = "redis://localhost:6379/0"

    DEFAULT_LOCALE: str = "ar"
    SUPPORTED_LOCALES: List[str] = ["ar", "en"]

    GRACE_PERIOD_DAYS: int = 7
    RENEWAL_REMINDER_DAYS: int = 14

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    def validate_production_safety(self) -> None:
        if not self.is_production:
            return
        if self.DEBUG:
            raise RuntimeError("DEBUG must be false when ENVIRONMENT=production")
        if self.SECRET_KEY in WEAK_SECRET_KEYS or len(self.SECRET_KEY) < 32:
            raise RuntimeError("SECRET_KEY must be a strong, unique value in production")


@lru_cache
def get_settings() -> Settings:
    return Settings()
