"""add_upload_fields_to_documents

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-04-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rendre client_id nullable (les clients uploadent sans client_id)
    op.alter_column('documents', 'client_id', nullable=True)

    # Ajouter uploaded_by_user_id (FK vers users)
    op.add_column('documents', sa.Column(
        'uploaded_by_user_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
    ))

    # Ajouter file_size en octets
    op.add_column('documents', sa.Column('file_size', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('documents', 'file_size')
    op.drop_column('documents', 'uploaded_by_user_id')
    op.alter_column('documents', 'client_id', nullable=False)
