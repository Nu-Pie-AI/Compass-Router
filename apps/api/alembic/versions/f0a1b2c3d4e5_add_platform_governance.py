"""add platform roles, settings, and governance revisions

Revision ID: f0a1b2c3d4e5
Revises: e7f9a2b4c6d8
Create Date: 2026-10-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "e7f9a2b4c6d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "platform_role_assignments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("granted_by", sa.String(), nullable=True),
        sa.Column("revoked_by", sa.String(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["granted_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["revoked_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role"),
    )
    op.create_index("ix_platform_role_assignments_user_id", "platform_role_assignments", ["user_id"])
    op.create_index("ix_platform_role_assignments_role", "platform_role_assignments", ["role"])
    op.create_index("ix_platform_role_assignments_status", "platform_role_assignments", ["status"])

    op.create_table(
        "platform_bootstrap_state",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("owner_user_id", sa.String(), nullable=False),
        sa.Column("owner_clerk_user_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_by", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["revoked_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_user_id"),
        sa.UniqueConstraint("owner_clerk_user_id"),
    )
    op.create_table(
        "platform_settings",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value_json", sa.Text(), nullable=False, server_default="null"),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_table(
        "pricing_revisions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("model_id", sa.String(), nullable=False),
        sa.Column("administrator_id", sa.String(), nullable=False),
        sa.Column("previous_policy_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("new_policy_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("change_reason", sa.Text(), nullable=False),
        sa.Column("effective_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["model_id"], ["models.id"]),
        sa.ForeignKeyConstraint(["administrator_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pricing_revisions_model_id", "pricing_revisions", ["model_id"])
    op.create_table(
        "routing_policy_revisions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("routing_policy_id", sa.String(), nullable=False),
        sa.Column("administrator_id", sa.String(), nullable=False),
        sa.Column("alias", sa.String(), nullable=False),
        sa.Column("candidate_models", sa.Text(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("change_reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["routing_policy_id"], ["routing_policies.id"]),
        sa.ForeignKeyConstraint(["administrator_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_routing_policy_revisions_routing_policy_id", "routing_policy_revisions", ["routing_policy_id"])
    op.create_index("ix_routing_policy_revisions_alias", "routing_policy_revisions", ["alias"])


def downgrade() -> None:
    op.drop_index("ix_routing_policy_revisions_alias", table_name="routing_policy_revisions")
    op.drop_index("ix_routing_policy_revisions_routing_policy_id", table_name="routing_policy_revisions")
    op.drop_table("routing_policy_revisions")
    op.drop_table("pricing_revisions")
    op.drop_table("platform_settings")
    op.drop_table("platform_bootstrap_state")
    op.drop_index("ix_platform_role_assignments_status", table_name="platform_role_assignments")
    op.drop_index("ix_platform_role_assignments_role", table_name="platform_role_assignments")
    op.drop_index("ix_platform_role_assignments_user_id", table_name="platform_role_assignments")
    op.drop_table("platform_role_assignments")
