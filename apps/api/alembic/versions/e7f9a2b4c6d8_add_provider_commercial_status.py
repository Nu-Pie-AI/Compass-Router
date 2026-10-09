"""add explicit provider commercial approval state

Revision ID: e7f9a2b4c6d8
Revises: d6e8f1a0b234
Create Date: 2026-10-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f9a2b4c6d8"
down_revision: Union[str, Sequence[str], None] = "d6e8f1a0b234"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("providers") as batch:
        batch.add_column(sa.Column("commercial_status", sa.String(), nullable=False, server_default="unreviewed"))
        batch.alter_column("commercial_status", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("providers") as batch:
        batch.drop_column("commercial_status")
