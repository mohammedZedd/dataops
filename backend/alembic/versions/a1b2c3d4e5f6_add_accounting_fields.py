"""add_accounting_fields

Revision ID: a1b2c3d4e5f6
Revises: f7a8b9c0d1e2
Create Date: 2026-04-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # clients: secteur d'activité
    op.add_column('clients', sa.Column('secteur_activite', sa.String(100), nullable=True))

    # invoices: champs comptables
    op.add_column('invoices', sa.Column('direction', sa.String(10), nullable=True))
    op.add_column('invoices', sa.Column(
        'tva_rate', sa.Float(), nullable=False, server_default=sa.text('20.0')
    ))
    op.add_column('invoices', sa.Column(
        'accounting_validated', sa.Boolean(), nullable=False, server_default=sa.text('false')
    ))
    op.add_column('invoices', sa.Column('validated_accounts', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'validated_accounts')
    op.drop_column('invoices', 'accounting_validated')
    op.drop_column('invoices', 'tva_rate')
    op.drop_column('invoices', 'direction')
    op.drop_column('clients', 'secteur_activite')
