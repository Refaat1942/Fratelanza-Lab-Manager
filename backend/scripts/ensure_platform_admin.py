"""Ensure platform superadmin exists with known credentials (runs on every deploy)."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import async_session_factory
from app.models.platform import PlatformUser

PLATFORM_USERNAME = "superadmin"
PLATFORM_PASSWORD = "Admin@123"


async def ensure_platform_admin() -> None:
    async with async_session_factory() as db:
        result = await db.execute(select(PlatformUser).where(PlatformUser.username == PLATFORM_USERNAME))
        user = result.scalar_one_or_none()
        password_hash = get_password_hash(PLATFORM_PASSWORD)

        if user:
            user.password_hash = password_hash
            user.is_active = True
            user.is_superadmin = True
            print(f"Reset password for platform admin: {PLATFORM_USERNAME}")
        else:
            db.add(
                PlatformUser(
                    username=PLATFORM_USERNAME,
                    password_hash=password_hash,
                    full_name="Platform Administrator",
                    is_superadmin=True,
                )
            )
            print(f"Created platform admin: {PLATFORM_USERNAME}")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(ensure_platform_admin())
