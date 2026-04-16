"""add doc_type and description to documents

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("doc_type", sa.String(20), nullable=True))
    op.add_column("documents", sa.Column("description", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "description")
    op.drop_column("documents", "doc_type")
