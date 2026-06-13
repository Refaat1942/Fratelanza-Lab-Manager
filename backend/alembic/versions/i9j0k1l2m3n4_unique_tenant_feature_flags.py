"""Add unique constraint on tenant feature flags

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
"""
from typing import Sequence, Union

from alembic import op

revision: str = "i9j0k1l2m3n4"
down_revision: Union[str, None] = "h8i9j0k1l2m3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM tenant_feature_flags a
        USING tenant_feature_flags b
        WHERE a.id > b.id
          AND a.tenant_id = b.tenant_id
          AND a.feature_key = b.feature_key
        """
    )
    op.create_unique_constraint(
        "uq_tenant_feature_flags_tenant_key",
        "tenant_feature_flags",
        ["tenant_id", "feature_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_tenant_feature_flags_tenant_key",
        "tenant_feature_flags",
        type_="unique",
    )
