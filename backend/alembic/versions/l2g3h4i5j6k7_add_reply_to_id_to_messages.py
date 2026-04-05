"""add reply_to_id to messages

Revision ID: l2g3h4i5j6k7
Revises: k1f2g3h4i5j6
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "l2g3h4i5j6k7"
down_revision: Union[str, None] = "k1f2g3h4i5j6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("reply_to_id", sa.String(), sa.ForeignKey("messages.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "reply_to_id")
