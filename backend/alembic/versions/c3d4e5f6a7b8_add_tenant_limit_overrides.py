"""add tenant limit overrides

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("max_users_override", sa.Integer(), nullable=True))
    op.add_column("tenants", sa.Column("max_branches_override", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "max_branches_override")
    op.drop_column("tenants", "max_users_override")
