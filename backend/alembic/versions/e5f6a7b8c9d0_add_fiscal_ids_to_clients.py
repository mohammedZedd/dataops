"""add fiscal IDs to clients (ice, if_number, rc, tp, cnss)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-05 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("ice", sa.String(20), nullable=True))
    op.add_column("clients", sa.Column("if_number", sa.String(50), nullable=True))
    op.add_column("clients", sa.Column("rc", sa.String(50), nullable=True))
    op.add_column("clients", sa.Column("tp", sa.String(50), nullable=True))
    op.add_column("clients", sa.Column("cnss", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("clients", "cnss")
    op.drop_column("clients", "tp")
    op.drop_column("clients", "rc")
    op.drop_column("clients", "if_number")
    op.drop_column("clients", "ice")
