"""add AI accounting tables (ai_analyses, journal_entries)

Revision ID: q7l8m9n0o1p2
Revises: p6k7l8m9n0o1
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
        "ai_analyses",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("document_id", sa.String(), sa.ForeignKey("documents.id"), unique=True, nullable=False),
        sa.Column("company_id", sa.String(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=True),
        sa.Column("confidence", sa.Float(), server_default="0", nullable=False),
        sa.Column("extraction_data", sa.JSON(), nullable=True),
        sa.Column("accounting_entries", sa.JSON(), nullable=True),
        sa.Column("tva_details", sa.JSON(), nullable=True),
        sa.Column("alerts", sa.JSON(), nullable=True),
        sa.Column("suggestions", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("validated_by_id", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("validated_at", sa.DateTime(), nullable=True),
        sa.Column("corrections", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "journal_entries",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.String(), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("document_id", sa.String(), sa.ForeignKey("documents.id"), nullable=True),
        sa.Column("ai_analysis_id", sa.String(), sa.ForeignKey("ai_analyses.id"), nullable=True),
        sa.Column("client_id", sa.String(), sa.ForeignKey("clients.id"), nullable=True),
        sa.Column("journal_type", sa.String(30), nullable=False),
        sa.Column("entry_date", sa.DateTime(), nullable=False),
        sa.Column("entry_number", sa.String(50), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("compte_debit", sa.String(20), nullable=False),
        sa.Column("libelle_debit", sa.String(255), nullable=True),
        sa.Column("compte_credit", sa.String(20), nullable=False),
        sa.Column("libelle_credit", sa.String(255), nullable=True),
        sa.Column("montant", sa.Float(), server_default="0", nullable=False),
        sa.Column("is_validated", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_by_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("journal_entries")
    op.drop_table("ai_analyses")
