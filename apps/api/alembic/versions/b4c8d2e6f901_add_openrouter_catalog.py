"""add OpenRouter catalog snapshots and pricing policies

Revision ID: b4c8d2e6f901
Revises: a3b7c9d1e2f4
Create Date: 2026-10-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4c8d2e6f901"
down_revision: Union[str, Sequence[str], None] = "a3b7c9d1e2f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("models") as batch:
        batch.add_column(sa.Column("catalog_source", sa.String(), nullable=False, server_default="seeded"))
        batch.add_column(sa.Column("raw_metadata_json", sa.Text(), nullable=False, server_default="{}"))
        batch.add_column(sa.Column("input_price_usd_per_million", sa.Numeric(20, 12), nullable=True))
        batch.add_column(sa.Column("output_price_usd_per_million", sa.Numeric(20, 12), nullable=True))
        batch.add_column(sa.Column("pricing_policy_version", sa.String(), nullable=True))
        batch.add_column(sa.Column("source_created_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("last_synced_at", sa.DateTime(), nullable=True))
        batch.create_index("ix_models_last_synced_at", ["last_synced_at"], unique=False)
        batch.alter_column("catalog_source", server_default=None)
        batch.alter_column("raw_metadata_json", server_default=None)

    op.create_table(
        "catalog_sync_runs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("source_revision", sa.String(), nullable=True),
        sa.Column("etag", sa.String(), nullable=True),
        sa.Column("model_count", sa.Integer(), nullable=False),
        sa.Column("raw_snapshot_json", sa.Text(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("stale_after_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_catalog_sync_runs_source", "catalog_sync_runs", ["source"], unique=False)
    op.create_index("ix_catalog_sync_runs_status", "catalog_sync_runs", ["status"], unique=False)
    op.create_index("ix_catalog_sync_runs_source_revision", "catalog_sync_runs", ["source_revision"], unique=False)

    op.create_table(
        "pricing_policies",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("markup_bps", sa.Integer(), nullable=False),
        sa.Column("usd_to_inr_paise_per_usd", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("effective_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version"),
    )
    op.create_index("ix_pricing_policies_version", "pricing_policies", ["version"], unique=False)
    op.create_index("ix_pricing_policies_status", "pricing_policies", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_pricing_policies_status", table_name="pricing_policies")
    op.drop_index("ix_pricing_policies_version", table_name="pricing_policies")
    op.drop_table("pricing_policies")
    op.drop_index("ix_catalog_sync_runs_source_revision", table_name="catalog_sync_runs")
    op.drop_index("ix_catalog_sync_runs_status", table_name="catalog_sync_runs")
    op.drop_index("ix_catalog_sync_runs_source", table_name="catalog_sync_runs")
    op.drop_table("catalog_sync_runs")
    with op.batch_alter_table("models") as batch:
        batch.drop_index("ix_models_last_synced_at")
        batch.drop_column("last_synced_at")
        batch.drop_column("source_created_at")
        batch.drop_column("pricing_policy_version")
        batch.drop_column("output_price_usd_per_million")
        batch.drop_column("input_price_usd_per_million")
        batch.drop_column("raw_metadata_json")
        batch.drop_column("catalog_source")
