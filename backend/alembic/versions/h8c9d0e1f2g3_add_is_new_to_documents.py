"""add is_new to documents

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-04-05 22:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "h8c9d0e1f2g3"
down_revision: Union[str, None] = "g7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("documents", sa.Column("is_new", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    # Mark existing documents as not new
    op.execute("UPDATE documents SET is_new = false")

def downgrade() -> None:
    op.drop_column("documents", "is_new")
