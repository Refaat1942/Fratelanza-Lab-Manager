"""PostgreSQL database manager — platform registry + per-tenant databases."""

from __future__ import annotations

import asyncio
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote_plus, urlparse, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine

from app.core.config import get_settings

settings = get_settings()
_manager: "DatabaseManager | None" = None


def sanitize_tenant_code(code: str) -> str:
    safe = re.sub(r"[^a-z0-9]+", "_", code.strip().lower()).strip("_")
    return safe or "tenant"


def tenant_database_name(tenant_code: str) -> str:
    return f"{settings.TENANT_DATABASE_PREFIX}{sanitize_tenant_code(tenant_code)}"


class DatabaseManager:
    def __init__(self) -> None:
        self._platform_async_url = settings.platform_database_url
        self._platform_sync_url = settings.platform_database_url_sync
        self._platform_engine = create_async_engine(
            self._platform_async_url, echo=settings.DEBUG, pool_pre_ping=True
        )
        self._platform_sync_engine = create_engine(
            self._platform_sync_url, echo=settings.DEBUG, pool_pre_ping=True
        )
        self._platform_session_factory = async_sessionmaker(
            self._platform_engine, class_=AsyncSession, expire_on_commit=False
        )
        self._platform_sync_session_factory = sessionmaker(
            self._platform_sync_engine, class_=Session, expire_on_commit=False
        )
        self._tenant_engines: dict[str, AsyncEngine] = {}
        self._tenant_session_factories: dict[str, async_sessionmaker[AsyncSession]] = {}
        self._lock = asyncio.Lock()

    @property
    def platform_database_name(self) -> str:
        return urlparse(self._platform_async_url).path.lstrip("/") or "labmaster"

    def build_tenant_urls(self, database_name: str) -> tuple[str, str]:
        async_url = self._replace_database(self._platform_async_url, database_name)
        sync_url = self._replace_database(self._platform_sync_url, database_name)
        return async_url, sync_url

    @staticmethod
    def _replace_database(url: str, database_name: str) -> str:
        parsed = urlparse(url)
        return urlunparse(parsed._replace(path=f"/{database_name}"))

    def resolve_tenant_database(self, tenant_code: str | None, database_name: str | None) -> str:
        if database_name:
            return database_name
        if settings.TENANT_DATABASE_PER_CUSTOMER and tenant_code:
            return tenant_database_name(tenant_code)
        return self.platform_database_name

    async def get_tenant_session_factory(self, database_name: str) -> async_sessionmaker[AsyncSession]:
        if database_name == self.platform_database_name:
            return self._platform_session_factory
        async with self._lock:
            if database_name not in self._tenant_session_factories:
                async_url, _ = self.build_tenant_urls(database_name)
                engine = create_async_engine(async_url, echo=settings.DEBUG, pool_pre_ping=True)
                self._tenant_engines[database_name] = engine
                self._tenant_session_factories[database_name] = async_sessionmaker(
                    engine, class_=AsyncSession, expire_on_commit=False
                )
            return self._tenant_session_factories[database_name]

    async def platform_session(self) -> AsyncSession:
        return self._platform_session_factory()

    async def tenant_session(self, database_name: str) -> AsyncSession:
        factory = await self.get_tenant_session_factory(database_name)
        return factory()

    def create_database_if_not_exists(self, database_name: str) -> None:
        with self._platform_sync_engine.connect() as conn:
            conn = conn.execution_options(isolation_level="AUTOCOMMIT")
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": database_name},
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{database_name}"'))

    def run_migrations(self, database_name: str) -> None:
        async_url, sync_url = self.build_tenant_urls(database_name)
        backend_dir = Path(__file__).resolve().parents[2]
        env = {
            **dict(__import__("os").environ),
            "DATABASE_URL": async_url,
            "DATABASE_URL_SYNC": sync_url,
        }
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=str(backend_dir),
            env=env,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"Alembic failed for database {database_name}:\n{result.stderr or result.stdout}"
            )


def get_database_manager() -> DatabaseManager:
    global _manager
    if _manager is None:
        _manager = DatabaseManager()
    return _manager
