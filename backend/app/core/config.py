from functools import lru_cache
from typing import List, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "change-me-in-production-use-openssl-rand-hex-32"


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
    ENABLE_API_DOCS: Optional[bool] = None
    BOOTSTRAP_ADMIN_ACCOUNTS: Optional[bool] = None
    SEED_DEMO_DATA: Optional[bool] = None

    PLATFORM_ADMIN_USERNAME: str = "superadmin"
    PLATFORM_ADMIN_PASSWORD: Optional[str] = None
    DEMO_TENANT_CODE: str = "demo-lab"
    DEMO_ADMIN_USERNAME: str = "labadmin"
    DEMO_ADMIN_PASSWORD: Optional[str] = None

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:13000",
        "https://labmaster.fratelanza.com",
        "http://labmaster.fratelanza.com",
    ]
    RATE_LIMIT: str = "100/minute"
    LOGIN_RATE_LIMIT: str = "5/minute"
    PLATFORM_LOGIN_RATE_LIMIT: str = "5/minute"
    REFRESH_RATE_LIMIT: str = "10/minute"

    REDIS_URL: str = "redis://localhost:6379/0"

    DEFAULT_LOCALE: str = "ar"
    SUPPORTED_LOCALES: List[str] = ["ar", "en"]

    GRACE_PERIOD_DAYS: int = 7
    RENEWAL_REMINDER_DAYS: int = 14

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    @model_validator(mode="after")
    def validate_security_defaults(self) -> "Settings":
        if self.ENABLE_API_DOCS is None:
            self.ENABLE_API_DOCS = not self.is_production
        if self.BOOTSTRAP_ADMIN_ACCOUNTS is None:
            self.BOOTSTRAP_ADMIN_ACCOUNTS = not self.is_production
        if self.SEED_DEMO_DATA is None:
            self.SEED_DEMO_DATA = not self.is_production

        if self.is_production:
            if self.DEBUG:
                raise ValueError("DEBUG must be false in production")
            if self.SECRET_KEY == DEFAULT_SECRET_KEY:
                raise ValueError("SECRET_KEY must be changed before running in production")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
