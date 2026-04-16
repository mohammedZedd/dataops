"""add task_comments, comments_count, restore client_notes

Revision ID: o5j6k7l8m9n0
Revises: n4i5j6k7l8m9
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "o5j6k7l8m9n0"
down_revision: Union[str, None] = "n4i5j6k7l8m9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add comments_count to client_tasks
    op.add_column("client_tasks", sa.Column("comments_count", sa.Integer(), server_default="0", nullable=False))

    # Create task_comments table
    op.create_table(
        "task_comments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("task_id", sa.String(), sa.ForeignKey("client_tasks.id"), nullable=False),
        sa.Column("author_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Restore client_notes table
    op.create_table(
        "client_notes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("client_id", sa.String(), sa.ForeignKey("clients.id"), nullable=False),
        sa.Column("company_id", sa.String(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("author_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("color", sa.String(20), server_default="yellow", nullable=False),
        sa.Column("is_pinned", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("client_notes")
    op.drop_table("task_comments")
    op.drop_column("client_tasks", "comments_count")
