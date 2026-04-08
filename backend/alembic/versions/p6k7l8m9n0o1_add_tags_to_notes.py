"""add tags to client_notes

Revision ID: p6k7l8m9n0o1
Revises: o5j6k7l8m9n0
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "p6k7l8m9n0o1"
down_revision: Union[str, None] = "o5j6k7l8m9n0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("client_notes", sa.Column("tags", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("client_notes", "tags")
