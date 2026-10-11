"""merge the existing schema relocation and M13 policy heads

Revision ID: h2i3j4k5l6m7
Revises: a1b2c3d4e5f6, g1h2i3j4k5l6
Create Date: 2026-10-11
"""

from typing import Sequence, Union


revision: str = "h2i3j4k5l6m7"
down_revision: Union[str, Sequence[str], None] = ("a1b2c3d4e5f6", "g1h2i3j4k5l6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
