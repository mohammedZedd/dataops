"""add access_level to users and clients

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-05 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("access_level", sa.String(20), nullable=False, server_default="full"))
    op.add_column("clients", sa.Column("access_level", sa.String(20), nullable=False, server_default="full"))

    # Existing revoked users/clients: set access_level = "blocked"
    op.execute("UPDATE users SET access_level = 'blocked' WHERE is_active = FALSE")
    op.execute("UPDATE clients SET access_level = 'blocked' WHERE is_active = FALSE")


def downgrade() -> None:
    op.drop_column("clients", "access_level")
    op.drop_column("users", "access_level")
