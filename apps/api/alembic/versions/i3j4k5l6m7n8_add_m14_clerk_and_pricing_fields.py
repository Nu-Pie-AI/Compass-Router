"""add Clerk organization invitation and pricing policy fields

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-10-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i3j4k5l6m7n8"
down_revision: Union[str, Sequence[str], None] = "h2i3j4k5l6m7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("clerk_organization_id", sa.String(), nullable=True))
    op.create_index("ix_organizations_clerk_organization_id", "organizations", ["clerk_organization_id"], unique=True)
    op.add_column("invitations", sa.Column("clerk_invitation_id", sa.String(), nullable=True))
    op.add_column("invitations", sa.Column("delivery_provider", sa.String(), nullable=False, server_default="compass"))
    with op.batch_alter_table("invitations") as batch:
        batch.alter_column("token_hash", existing_type=sa.String(), nullable=True)
    op.create_index("ix_invitations_clerk_invitation_id", "invitations", ["clerk_invitation_id"], unique=True)
    op.add_column("pricing_policies", sa.Column("fx_buffer_bps", sa.Integer(), nullable=False, server_default="500"))
    op.add_column("pricing_policies", sa.Column("platform_fee_bps", sa.Integer(), nullable=False, server_default="500"))
    op.add_column("pricing_policies", sa.Column("fx_source", sa.String(), nullable=False, server_default="fixed_local_fallback"))
    op.add_column("pricing_policies", sa.Column("fx_fetched_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("pricing_policies", "fx_fetched_at")
    op.drop_column("pricing_policies", "fx_source")
    op.drop_column("pricing_policies", "platform_fee_bps")
    op.drop_column("pricing_policies", "fx_buffer_bps")
    op.drop_index("ix_invitations_clerk_invitation_id", table_name="invitations")
    with op.batch_alter_table("invitations") as batch:
        batch.alter_column("token_hash", existing_type=sa.String(), nullable=False)
    op.drop_column("invitations", "delivery_provider")
    op.drop_column("invitations", "clerk_invitation_id")
    op.drop_index("ix_organizations_clerk_organization_id", table_name="organizations")
    op.drop_column("organizations", "clerk_organization_id")
