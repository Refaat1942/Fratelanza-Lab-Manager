"""Ensure the platform admin exists. Pass --reset NEW_PASSWORD to recover a lost password:

    docker compose -f docker-compose.prod.yml --env-file .env.production exec backend \
        python scripts/ensure_platform_admin.py --reset 'NewStrongPassword'
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.bootstrap.admin_credentials import ensure_platform_admin

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reset", metavar="NEW_PASSWORD", help="set a new password for the existing account")
    args = parser.parse_args()
    if args.reset is not None and len(args.reset) < 8:
        parser.error("password must be at least 8 characters")
    asyncio.run(ensure_platform_admin(reset_password=args.reset))
