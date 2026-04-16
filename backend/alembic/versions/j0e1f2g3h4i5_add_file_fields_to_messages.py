"""add file fields to messages

Revision ID: j0e1f2g3h4i5
Revises: i9d0e1f2g3h4
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "j0e1f2g3h4i5"
down_revision: Union[str, None] = "i9d0e1f2g3h4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column("messages", sa.Column("file_name", sa.String(500), nullable=True))
    op.add_column("messages", sa.Column("file_url", sa.String(1000), nullable=True))
    op.add_column("messages", sa.Column("document_id", sa.String(), sa.ForeignKey("documents.id"), nullable=True))

def downgrade() -> None:
    op.drop_column("messages", "document_id")
    op.drop_column("messages", "file_url")
    op.drop_column("messages", "file_name")
