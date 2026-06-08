"""add tenant subscription settings to branding

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenant_branding", sa.Column("renewal_reminder_days", sa.Integer(), server_default="14", nullable=False))
    op.add_column("tenant_branding", sa.Column("renewal_reminder_enabled", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("tenant_branding", sa.Column("subscription_end_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("tenant_branding", "subscription_end_date")
    op.drop_column("tenant_branding", "renewal_reminder_enabled")
    op.drop_column("tenant_branding", "renewal_reminder_days")
