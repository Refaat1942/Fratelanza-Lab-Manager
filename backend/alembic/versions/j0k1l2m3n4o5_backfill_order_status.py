"""Backfill order status from result progress

Orders never advanced past COLLECTED before results updated them. Mark orders COMPLETED
when every remaining result is released, IN_LAB when results were entered.

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
"""
from typing import Sequence, Union

from alembic import op

revision: str = "j0k1l2m3n4o5"
down_revision: Union[str, None] = "i9j0k1l2m3n4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ACTIVE_ORDER = "o.deleted_at IS NULL AND o.status IN ('PENDING', 'COLLECTED', 'IN_LAB')"


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE lab_orders o
        SET status = 'COMPLETED',
            completed_at = COALESCE(
                (SELECT max(r.released_at) FROM lab_results r WHERE r.order_id = o.id AND r.deleted_at IS NULL),
                now()
            )
        WHERE {ACTIVE_ORDER}
          AND EXISTS (SELECT 1 FROM lab_results r WHERE r.order_id = o.id AND r.deleted_at IS NULL)
          AND NOT EXISTS (
              SELECT 1 FROM lab_results r
              WHERE r.order_id = o.id AND r.deleted_at IS NULL AND r.status <> 'RELEASED'
          )
        """
    )
    op.execute(
        f"""
        UPDATE lab_orders o
        SET status = 'IN_LAB', collected_at = COALESCE(o.collected_at, o.ordered_at)
        WHERE {ACTIVE_ORDER} AND o.status <> 'IN_LAB'
          AND EXISTS (
              SELECT 1 FROM lab_results r
              WHERE r.order_id = o.id AND r.deleted_at IS NULL AND r.status <> 'PENDING'
          )
        """
    )


def downgrade() -> None:
    # Data-only backfill; statuses are recomputed by the application going forward.
    pass
