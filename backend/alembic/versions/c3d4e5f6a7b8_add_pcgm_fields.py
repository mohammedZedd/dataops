"""add_pcgm_fields

Adds regime_fiscal, forme_juridique to clients.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-04 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("regime_fiscal", sa.String(100), nullable=True))
    op.add_column("clients", sa.Column("forme_juridique", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("clients", "forme_juridique")
    op.drop_column("clients", "regime_fiscal")
