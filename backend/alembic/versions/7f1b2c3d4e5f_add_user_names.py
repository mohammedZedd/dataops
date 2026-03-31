"""add_user_names

Revision ID: 7f1b2c3d4e5f
Revises: 0f2c90f7b8f8
Create Date: 2026-03-30 23:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f1b2c3d4e5f'
down_revision: Union[str, None] = '0f2c90f7b8f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns as nullable with a temporary default to avoid breaking existing rows
    op.add_column('users', sa.Column('first_name', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(length=100), nullable=True))

    # Backfill existing rows with empty strings (or set a safe placeholder)
    op.execute("UPDATE users SET first_name = '' WHERE first_name IS NULL")
    op.execute("UPDATE users SET last_name = '' WHERE last_name IS NULL")

    # Enforce NOT NULL and drop any default
    op.alter_column('users', 'first_name', existing_type=sa.String(length=100), nullable=False)
    op.alter_column('users', 'last_name', existing_type=sa.String(length=100), nullable=False)


def downgrade() -> None:
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')
