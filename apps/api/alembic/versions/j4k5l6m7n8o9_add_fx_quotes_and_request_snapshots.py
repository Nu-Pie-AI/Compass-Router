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
    )
    op.create_index("ix_fx_rate_quotes_base_currency", "fx_rate_quotes", ["base_currency"])
    op.create_index("ix_fx_rate_quotes_quote_currency", "fx_rate_quotes", ["quote_currency"])
    op.create_index("ix_fx_rate_quotes_provider", "fx_rate_quotes", ["provider"])
    op.create_index("ix_fx_rate_quotes_publication_date", "fx_rate_quotes", ["publication_date"])
    op.create_index("ix_fx_rate_quotes_retrieved_at", "fx_rate_quotes", ["retrieved_at"])
    op.create_index("ix_fx_rate_quotes_validation_status", "fx_rate_quotes", ["validation_status"])
    op.add_column("llm_requests", sa.Column("fx_quote_id", sa.String(), nullable=True))
    op.add_column("llm_requests", sa.Column("fx_rate", sa.Numeric(24, 12), nullable=True))
    op.add_column("llm_requests", sa.Column("pricing_policy_version", sa.String(), nullable=True))
    op.create_index("ix_llm_requests_fx_quote_id", "llm_requests", ["fx_quote_id"])


def downgrade() -> None:
    op.drop_index("ix_llm_requests_fx_quote_id", table_name="llm_requests")
    op.drop_column("llm_requests", "pricing_policy_version")
    op.drop_column("llm_requests", "fx_rate")
    op.drop_column("llm_requests", "fx_quote_id")
    op.drop_index("ix_fx_rate_quotes_validation_status", table_name="fx_rate_quotes")
    op.drop_index("ix_fx_rate_quotes_retrieved_at", table_name="fx_rate_quotes")
    op.drop_index("ix_fx_rate_quotes_publication_date", table_name="fx_rate_quotes")
    op.drop_index("ix_fx_rate_quotes_provider", table_name="fx_rate_quotes")
    op.drop_index("ix_fx_rate_quotes_quote_currency", table_name="fx_rate_quotes")
    op.drop_index("ix_fx_rate_quotes_base_currency", table_name="fx_rate_quotes")
    op.drop_table("fx_rate_quotes")
