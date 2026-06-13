"""add tenants.database_name for per-customer PostgreSQL databases

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("database_name", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_tenants_database_name", "tenants", ["database_name"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_tenants_database_name", table_name="tenants")
    op.drop_column("tenants", "database_name")
