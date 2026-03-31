"""add_client_role_and_links

Revision ID: b3d4c5e6f7a8
Revises: 9c2f1a6b7d8e
Create Date: 2026-03-31 00:15:00.000000

"""
from typing import Sequence, Union
from datetime import datetime
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3d4c5e6f7a8"
down_revision: Union[str, None] = "9c2f1a6b7d8e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add CLIENT to enums
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CLIENT'")
    op.execute("ALTER TYPE invite_role ADD VALUE IF NOT EXISTS 'CLIENT'")

    # Clients: add company_id
    op.add_column("clients", sa.Column("company_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_clients_company_id", "clients", "companies", ["company_id"], ["id"])

    conn = op.get_bind()
    company_id = conn.execute(sa.text("SELECT id FROM companies ORDER BY created_at LIMIT 1")).scalar()
    if not company_id:
        company_id = str(uuid.uuid4())
        conn.execute(
            sa.text("INSERT INTO companies (id, name, created_at) VALUES (:id, :name, :created_at)"),
            {"id": company_id, "name": "Cabinet principal", "created_at": datetime.utcnow()},
        )

    conn.execute(
        sa.text("UPDATE clients SET company_id = :company_id WHERE company_id IS NULL"),
        {"company_id": company_id},
    )
    op.alter_column("clients", "company_id", existing_type=sa.String(), nullable=False)

    # Users: add client_id
    op.add_column("users", sa.Column("client_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_users_client_id", "users", "clients", ["client_id"], ["id"])

    # Invitations: add client_id
    op.add_column("invitations", sa.Column("client_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_invitations_client_id", "invitations", "clients", ["client_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_invitations_client_id", "invitations", type_="foreignkey")
    op.drop_column("invitations", "client_id")

    op.drop_constraint("fk_users_client_id", "users", type_="foreignkey")
    op.drop_column("users", "client_id")

    op.drop_constraint("fk_clients_company_id", "clients", type_="foreignkey")
    op.drop_column("clients", "company_id")

    # Enums: cannot easily remove value in Postgres; leave as-is.
