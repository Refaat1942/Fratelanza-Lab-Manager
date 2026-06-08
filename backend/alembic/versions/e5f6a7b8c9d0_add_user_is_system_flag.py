"""add is_system flag to users

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_system", sa.Boolean(), server_default="false", nullable=False))
    # Hide existing platform/bootstrap tenant admins from lab user management
    op.execute(
        """
        UPDATE users
        SET is_system = true
        WHERE is_tenant_admin = true
          AND LOWER(username) IN ('admin', 'labadmin', 'superadmin')
          AND deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("users", "is_system")
