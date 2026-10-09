"""add provider-neutral catalog protocol and capability metadata

Revision ID: c5d7e9f0a123
Revises: b4c8d2e6f901
Create Date: 2026-10-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5d7e9f0a123"
down_revision: Union[str, Sequence[str], None] = "b4c8d2e6f901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("providers") as batch:
        batch.add_column(sa.Column("protocol", sa.String(), nullable=False, server_default="litellm"))
        batch.add_column(sa.Column("catalog_source", sa.String(), nullable=False, server_default="manual"))
        batch.add_column(sa.Column("last_verified_at", sa.DateTime(), nullable=True))
        batch.alter_column("protocol", server_default=None)
        batch.alter_column("catalog_source", server_default=None)

    with op.batch_alter_table("models") as batch:
        batch.add_column(sa.Column("protocol", sa.String(), nullable=False, server_default="litellm"))
        batch.add_column(sa.Column("capability_types", sa.Text(), nullable=False, server_default="chat_completion,responses"))
        batch.add_column(sa.Column("input_modalities", sa.Text(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("output_modalities", sa.Text(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("max_output_tokens", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("route_readiness_reason", sa.Text(), nullable=False, server_default=""))
        batch.alter_column("protocol", server_default=None)
        batch.alter_column("capability_types", server_default=None)
        batch.alter_column("input_modalities", server_default=None)
        batch.alter_column("output_modalities", server_default=None)
        batch.alter_column("route_readiness_reason", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("models") as batch:
        batch.drop_column("route_readiness_reason")
        batch.drop_column("max_output_tokens")
        batch.drop_column("output_modalities")
        batch.drop_column("input_modalities")
        batch.drop_column("capability_types")
        batch.drop_column("protocol")

    with op.batch_alter_table("providers") as batch:
        batch.drop_column("last_verified_at")
        batch.drop_column("catalog_source")
        batch.drop_column("protocol")
