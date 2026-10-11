"""add many-to-many API key member and project policies

Revision ID: g1h2i3j4k5l6
Revises: f0a1b2c3d4e5
Create Date: 2026-10-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g1h2i3j4k5l6"
down_revision: Union[str, Sequence[str], None] = "f0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "api_key_member_assignments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("api_key_id", sa.String(), nullable=False),
        sa.Column("member_id", sa.String(), nullable=False),
        sa.Column("assigned_by", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["api_key_id"], ["api_keys.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["team_members.id"]),
        sa.ForeignKeyConstraint(["assigned_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("api_key_id", "member_id"),
    )
    op.create_index("ix_api_key_member_assignments_api_key_id", "api_key_member_assignments", ["api_key_id"])
    op.create_index("ix_api_key_member_assignments_member_id", "api_key_member_assignments", ["member_id"])
    op.create_index("ix_api_key_member_assignments_status", "api_key_member_assignments", ["status"])
    op.create_table(
        "api_key_project_policies",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("api_key_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["api_key_id"], ["api_keys.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("api_key_id", "project_id"),
    )
    op.create_index("ix_api_key_project_policies_api_key_id", "api_key_project_policies", ["api_key_id"])
    op.create_index("ix_api_key_project_policies_project_id", "api_key_project_policies", ["project_id"])
    op.create_index("ix_api_key_project_policies_status", "api_key_project_policies", ["status"])


def downgrade() -> None:
    op.drop_index("ix_api_key_project_policies_status", table_name="api_key_project_policies")
    op.drop_index("ix_api_key_project_policies_project_id", table_name="api_key_project_policies")
    op.drop_index("ix_api_key_project_policies_api_key_id", table_name="api_key_project_policies")
    op.drop_table("api_key_project_policies")
    op.drop_index("ix_api_key_member_assignments_status", table_name="api_key_member_assignments")
    op.drop_index("ix_api_key_member_assignments_member_id", table_name="api_key_member_assignments")
    op.drop_index("ix_api_key_member_assignments_api_key_id", table_name="api_key_member_assignments")
    op.drop_table("api_key_member_assignments")
