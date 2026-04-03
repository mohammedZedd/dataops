"""add_phone_number_to_users

Revision ID: d5e6f7a8b9c0
Revises: c4e5d6f7a8b9
Create Date: 2026-04-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4e5d6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("phone_number", sa.String(30), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "phone_number")
