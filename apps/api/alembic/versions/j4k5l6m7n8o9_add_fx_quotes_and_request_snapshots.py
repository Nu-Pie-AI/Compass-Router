"""add durable FX quote history and request pricing snapshots

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j4k5l6m7n8o9"
down_revision: Union[str, Sequence[str], None] = "i3j4k5l6m7n8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    schema = "compass" if op.get_bind().dialect.name == "postgresql" else None
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("fx_rate_quotes", schema=schema):
        op.create_table(
        "fx_rate_quotes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("base_currency", sa.String(), nullable=False),
        sa.Column("quote_currency", sa.String(), nullable=False),
        sa.Column("rate", sa.Numeric(24, 12), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("publication_date", sa.DateTime(), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(), nullable=False),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("validation_status", sa.String(), nullable=False),
        sa.Column("source_reference", sa.Text(), nullable=False),
        sa.Column("failure_reason", sa.Text(), nullable=True),
            schema=schema,
        )
    existing = {index["name"] for index in inspector.get_indexes("fx_rate_quotes", schema=schema)}
    for name, column in (("base_currency", "base_currency"), ("quote_currency", "quote_currency"), ("provider", "provider"), ("publication_date", "publication_date"), ("retrieved_at", "retrieved_at"), ("validation_status", "validation_status")):
        if f"ix_fx_rate_quotes_{name}" not in existing:
            op.create_index(f"ix_fx_rate_quotes_{name}", "fx_rate_quotes", [column], schema=schema)
    llm_columns = {column["name"] for column in inspector.get_columns("llm_requests", schema=schema)}
    if "fx_quote_id" not in llm_columns:
        op.add_column("llm_requests", sa.Column("fx_quote_id", sa.String(), nullable=True), schema=schema)
    if "fx_rate" not in llm_columns:
        op.add_column("llm_requests", sa.Column("fx_rate", sa.Numeric(24, 12), nullable=True), schema=schema)
    if "pricing_policy_version" not in llm_columns:
        op.add_column("llm_requests", sa.Column("pricing_policy_version", sa.String(), nullable=True), schema=schema)
    llm_indexes = {index["name"] for index in inspector.get_indexes("llm_requests", schema=schema)}
    if "ix_llm_requests_fx_quote_id" not in llm_indexes:
        op.create_index("ix_llm_requests_fx_quote_id", "llm_requests", ["fx_quote_id"], schema=schema)


def downgrade() -> None:
    schema = "compass" if op.get_bind().dialect.name == "postgresql" else None
    op.drop_index("ix_llm_requests_fx_quote_id", table_name="llm_requests", schema=schema)
    op.drop_column("llm_requests", "pricing_policy_version", schema=schema)
    op.drop_column("llm_requests", "fx_rate", schema=schema)
    op.drop_column("llm_requests", "fx_quote_id", schema=schema)
    op.drop_index("ix_fx_rate_quotes_validation_status", table_name="fx_rate_quotes", schema=schema)
    op.drop_index("ix_fx_rate_quotes_retrieved_at", table_name="fx_rate_quotes", schema=schema)
    op.drop_index("ix_fx_rate_quotes_publication_date", table_name="fx_rate_quotes", schema=schema)
    op.drop_index("ix_fx_rate_quotes_provider", table_name="fx_rate_quotes", schema=schema)
    op.drop_index("ix_fx_rate_quotes_quote_currency", table_name="fx_rate_quotes", schema=schema)
    op.drop_index("ix_fx_rate_quotes_base_currency", table_name="fx_rate_quotes", schema=schema)
    op.drop_table("fx_rate_quotes", schema=schema)
