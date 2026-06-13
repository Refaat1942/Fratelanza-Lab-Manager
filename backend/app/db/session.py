from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.manager import get_database_manager


async def get_platform_db() -> AsyncGenerator[AsyncSession, None]:
    """Platform registry database (tenants, subscriptions, platform admins)."""
    session = await get_database_manager().platform_session()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_tenant_db(
    database_name: str | None = None,
) -> AsyncGenerator[AsyncSession, None]:
    """Tenant operational database — resolved from JWT in deps.get_tenant_db."""
    manager = get_database_manager()
    db_name = database_name or manager.platform_database_name
    session = await manager.tenant_session(db_name)
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


# Backward-compatible alias: lab routes should use tenant DB via deps.DbSession
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_platform_db():
        yield session


def __getattr__(name: str):
    """Lazy export for scripts that import async_session_factory from session."""
    if name == "async_session_factory":
        return get_database_manager()._platform_session_factory
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
