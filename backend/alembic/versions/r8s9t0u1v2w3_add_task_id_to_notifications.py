"""add task_id to notifications

Revision ID: r8s9t0u1v2w3
Revises: q7l8m9n0o1p2
Create Date: 2026-04-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "r8s9t0u1v2w3"
down_revision: Union[str, None] = "q7l8m9n0o1p2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("task_id", sa.String(), sa.ForeignKey("client_tasks.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notifications", "task_id")
