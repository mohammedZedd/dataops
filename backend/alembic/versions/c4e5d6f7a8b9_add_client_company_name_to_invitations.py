"""add_client_company_name_to_invitations

Revision ID: c4e5d6f7a8b9
Revises: b3d4c5e6f7a8
Create Date: 2026-03-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4e5d6f7a8b9"
down_revision: Union[str, None] = "b3d4c5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "invitations",
        sa.Column("client_company_name", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invitations", "client_company_name")
