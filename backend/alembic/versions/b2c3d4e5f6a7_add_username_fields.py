"""add username fields

Revision ID: b2c3d4e5f6a7
Revises: ad9e84bc1ec7
Create Date: 2026-06-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "ad9e84bc1ec7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("platform_users", sa.Column("username", sa.String(100), nullable=True))
    op.create_index("ix_platform_users_username", "platform_users", ["username"], unique=True)

    op.add_column("users", sa.Column("username", sa.String(100), nullable=True))
    op.create_index("ix_users_username", "users", ["username"])

    # Backfill from email local-part for existing rows
    op.execute("""
        UPDATE platform_users SET username = split_part(email, '@', 1) WHERE username IS NULL
    """)
    op.execute("""
        UPDATE users SET username = split_part(email, '@', 1) WHERE username IS NULL
    """)

    op.alter_column("platform_users", "username", nullable=False)
    op.alter_column("users", "username", nullable=False)

    op.alter_column("users", "email", nullable=True)
    op.alter_column("platform_users", "email", nullable=True)
    op.drop_constraint("uq_users_tenant_email", "users", type_="unique")
    op.create_unique_constraint("uq_users_tenant_username", "users", ["tenant_id", "username"])


def downgrade() -> None:
    op.drop_constraint("uq_users_tenant_username", "users", type_="unique")
    op.create_unique_constraint("uq_users_tenant_email", "users", ["tenant_id", "email"])
    op.alter_column("users", "email", nullable=False)
    op.drop_index("ix_users_username", "users")
    op.drop_column("users", "username")
    op.drop_index("ix_platform_users_username", "platform_users")
    op.drop_column("platform_users", "username")
