"""add source to documents

Revision ID: k1f2g3h4i5j6
Revises: j0e1f2g3h4i5
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "k1f2g3h4i5j6"
down_revision: Union[str, None] = "j0e1f2g3h4i5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("documents", sa.Column("source", sa.String(20), nullable=True))
    op.execute("UPDATE documents SET source = 'client'")

def downgrade() -> None:
    op.drop_column("documents", "source")
