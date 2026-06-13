"""Tenant lifecycle: soft delete, restore, permanent purge.

Revision ID: g7b8c9d0e1f2
Revises: e5f6a7b8c9d0
Create Date: 2026-06-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g7b8c9d0e1f2"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Normalize legacy statuses before shrinking enum
    op.execute(
        """
        UPDATE tenants
        SET status = 'SUSPENDED'
        WHERE deleted_at IS NULL AND status::text IN ('LOCKED', 'EXPIRED')
        """
    )
    op.execute(
        """
        UPDATE tenants
        SET status = 'ACTIVE'
        WHERE deleted_at IS NULL AND status::text IN ('TRIAL', 'ACTIVE')
        """
    )
    op.execute(
        """
        UPDATE tenants
        SET status = 'ACTIVE'
        WHERE deleted_at IS NOT NULL AND status::text NOT IN ('SUSPENDED')
        """
    )

    op.execute("ALTER TYPE tenantstatus RENAME TO tenantstatus_old")
    op.execute("CREATE TYPE tenantstatus AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED')")
    op.execute(
        """
        ALTER TABLE tenants
        ALTER COLUMN status TYPE tenantstatus
        USING (
            CASE
                WHEN deleted_at IS NOT NULL THEN 'DELETED'::tenantstatus
                WHEN status::text = 'SUSPENDED' THEN 'SUSPENDED'::tenantstatus
                ELSE 'ACTIVE'::tenantstatus
            END
        )
        """
    )
    op.execute("DROP TYPE tenantstatus_old")

    # Allow reusing codes from soft-deleted tenants
    op.drop_index("ix_tenants_code", table_name="tenants")
    op.create_index("ix_tenants_code", "tenants", ["code"], unique=False)
    op.execute(
        """
        CREATE UNIQUE INDEX uq_tenants_code_active
        ON tenants (code)
        WHERE deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_tenants_code_active")
    op.drop_index("ix_tenants_code", table_name="tenants")
    op.create_index("ix_tenants_code", "tenants", ["code"], unique=True)

    op.execute("ALTER TYPE tenantstatus RENAME TO tenantstatus_old")
    op.execute(
        "CREATE TYPE tenantstatus AS ENUM ('ACTIVE', 'SUSPENDED', 'LOCKED', 'TRIAL', 'EXPIRED')"
    )
    op.execute(
        """
        ALTER TABLE tenants
        ALTER COLUMN status TYPE tenantstatus
        USING (
            CASE
                WHEN status::text = 'DELETED' THEN 'LOCKED'::tenantstatus
                WHEN status::text = 'SUSPENDED' THEN 'SUSPENDED'::tenantstatus
                ELSE 'ACTIVE'::tenantstatus
            END
        )
        """
    )
    op.execute("DROP TYPE tenantstatus_old")
