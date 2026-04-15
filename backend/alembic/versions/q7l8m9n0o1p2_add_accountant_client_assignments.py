"""add accountant_client_assignments table

Revision ID: q7l8m9n0o1p2
Revises: p6k7l8m9n0o1
Create Date: 2026-04-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "q7l8m9n0o1p2"
down_revision: Union[str, None] = "p6k7l8m9n0o1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "accountant_client_assignments",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("accountant_id", sa.String(), nullable=False),
        sa.Column("client_id", sa.String(), nullable=False),
        sa.Column("company_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["accountant_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("accountant_id", "client_id", name="uq_accountant_client"),
    )
    op.create_index("ix_aca_accountant_id", "accountant_client_assignments", ["accountant_id"])
    op.create_index("ix_aca_client_id",     "accountant_client_assignments", ["client_id"])
    op.create_index("ix_aca_company_id",    "accountant_client_assignments", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_aca_company_id",    table_name="accountant_client_assignments")
    op.drop_index("ix_aca_client_id",     table_name="accountant_client_assignments")
    op.drop_index("ix_aca_accountant_id", table_name="accountant_client_assignments")
    op.drop_table("accountant_client_assignments")
