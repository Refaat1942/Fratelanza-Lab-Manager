"""CLI wrapper — ensure platform superadmin exists using env-supplied credentials."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.bootstrap.admin_credentials import ensure_platform_admin

if __name__ == "__main__":
    asyncio.run(ensure_platform_admin())
