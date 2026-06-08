from functools import lru_cache
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "change-me-in-production-use-openssl-rand-hex-32"
WEAK_SECRET_KEYS = {
    DEFAULT_SECRET_KEY,
    "change-me-in-production",
    "CHANGE_ME_OPENSSL_RAND_HEX_32",
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

    SECRET_KEY: str = DEFAULT_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BOOTSTRAP_ADMINS: bool = False
    RESET_BOOTSTRAP_PASSWORDS: bool = False
    ALLOW_DEMO_SEED: bool = False
    PLATFORM_ADMIN_USERNAME: str = "superadmin"
    PLATFORM_ADMIN_PASSWORD: str | None = None
    DEMO_ADMIN_USERNAME: str = "labadmin"
    DEMO_ADMIN_PASSWORD: str | None = None

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:13000",
        "https://labmaster.fratelanza.com",
        "http://labmaster.fratelanza.com",
    ]
    RATE_LIMIT: str = "100/minute"

    REDIS_URL: str = "redis://localhost:6379/0"

    DEFAULT_LOCALE: str = "ar"
    SUPPORTED_LOCALES: List[str] = ["ar", "en"]

    GRACE_PERIOD_DAYS: int = 7
    RENEWAL_REMINDER_DAYS: int = 14

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.is_production:
            if self.SECRET_KEY in WEAK_SECRET_KEYS or len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be a strong unique value in production")
            if self.DEBUG:
                raise ValueError("DEBUG must be false in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
