"""add Clerk webhook event ledger

Revision ID: a3b7c9d1e2f4
Revises: 91635f9f8736
Create Date: 2026-10-08
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3b7c9d1e2f4"
down_revision: Union[str, Sequence[str], None] = "91635f9f8736"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clerk_webhook_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("event_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("payload_hash", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
    )
    op.create_index(op.f("ix_clerk_webhook_events_event_id"), "clerk_webhook_events", ["event_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_clerk_webhook_events_event_id"), table_name="clerk_webhook_events")
    op.drop_table("clerk_webhook_events")
