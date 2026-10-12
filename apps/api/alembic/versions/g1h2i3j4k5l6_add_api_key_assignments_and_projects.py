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
    postgres = op.get_bind().dialect.name == "postgresql"
    schema = "compass" if postgres else None
    api_keys = "compass.api_keys" if postgres else "api_keys"
    team_members = "compass.team_members" if postgres else "team_members"
    users = "compass.users" if postgres else "users"
    projects = "compass.projects" if postgres else "projects"
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table("api_key_member_assignments", schema=schema):
        op.create_table(
        "api_key_member_assignments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("api_key_id", sa.String(), nullable=False),
        sa.Column("member_id", sa.String(), nullable=False),
        sa.Column("assigned_by", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["api_key_id"], [f"{api_keys}.id"]),
        sa.ForeignKeyConstraint(["member_id"], [f"{team_members}.id"]),
        sa.ForeignKeyConstraint(["assigned_by"], [f"{users}.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("api_key_id", "member_id"),
        schema=schema,
        )
    existing = {index["name"] for index in inspector.get_indexes("api_key_member_assignments", schema=schema)}
    for name, column in (("ix_api_key_member_assignments_api_key_id", "api_key_id"), ("ix_api_key_member_assignments_member_id", "member_id"), ("ix_api_key_member_assignments_status", "status")):
        if name not in existing:
            op.create_index(name, "api_key_member_assignments", [column], schema=schema)

    if not inspector.has_table("api_key_project_policies", schema=schema):
        op.create_table(
        "api_key_project_policies",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("api_key_id", sa.String(), nullable=False),
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["api_key_id"], [f"{api_keys}.id"]),
        sa.ForeignKeyConstraint(["project_id"], [f"{projects}.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("api_key_id", "project_id"),
        schema=schema,
        )
    existing = {index["name"] for index in inspector.get_indexes("api_key_project_policies", schema=schema)}
    for name, column in (("ix_api_key_project_policies_api_key_id", "api_key_id"), ("ix_api_key_project_policies_project_id", "project_id"), ("ix_api_key_project_policies_status", "status")):
        if name not in existing:
            op.create_index(name, "api_key_project_policies", [column], schema=schema)


def downgrade() -> None:
    schema = "compass" if op.get_bind().dialect.name == "postgresql" else None
    for name in ("status", "project_id", "api_key_id"):
        op.drop_index(f"ix_api_key_project_policies_{name}", table_name="api_key_project_policies", schema=schema)
    op.drop_table("api_key_project_policies", schema=schema)
    for name in ("status", "member_id", "api_key_id"):
        op.drop_index(f"ix_api_key_member_assignments_{name}", table_name="api_key_member_assignments", schema=schema)
    op.drop_table("api_key_member_assignments", schema=schema)
