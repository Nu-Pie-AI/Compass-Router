"""record whether normalized usage came from a provider or an estimate"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d6e8f1a0b234"
down_revision: Union[str, Sequence[str], None] = "c5d7e9f0a123"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("llm_requests") as batch:
        batch.add_column(sa.Column("usage_source", sa.String(), nullable=False, server_default="provider"))
        batch.alter_column("usage_source", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("llm_requests") as batch:
        batch.drop_column("usage_source")
