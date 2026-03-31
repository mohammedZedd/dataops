"""add_companies_and_invitations

Revision ID: 9c2f1a6b7d8e
Revises: 7f1b2c3d4e5f
Create Date: 2026-03-30 23:45:00.000000

"""
from typing import Sequence, Union
from datetime import datetime
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c2f1a6b7d8e"
down_revision: Union[str, None] = "7f1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Companies
    op.create_table(
        "companies",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    default_company_id = str(uuid.uuid4())
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO companies (id, name, created_at) VALUES (:id, :name, :created_at)"
        ),
        {"id": default_company_id, "name": "Cabinet principal", "created_at": datetime.utcnow()},
    )

    # Users — add company + flags
    op.add_column("users", sa.Column("company_id", sa.String(), nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=True))
    op.create_foreign_key("fk_users_company_id", "users", "companies", ["company_id"], ["id"])

    conn.execute(
        sa.text(
            "UPDATE users SET company_id = :id, is_active = TRUE, email_verified = FALSE "
            "WHERE company_id IS NULL"
        ),
        {"id": default_company_id},
    )

    op.alter_column("users", "company_id", existing_type=sa.String(), nullable=False)
    op.alter_column("users", "is_active", existing_type=sa.Boolean(), nullable=False)
    op.alter_column("users", "email_verified", existing_type=sa.Boolean(), nullable=False)

    # Invitations
    op.create_table(
        "invitations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("role", sa.Enum("ADMIN", "ACCOUNTANT", name="invite_role"), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "ACCEPTED", "EXPIRED", "CANCELLED", name="invitation_status"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("invited_by_user_id", sa.String(), nullable=False),
        sa.Column("company_id", sa.String(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invitations_email"), "invitations", ["email"], unique=False)
    op.create_index(op.f("ix_invitations_token"), "invitations", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_invitations_token"), table_name="invitations")
    op.drop_index(op.f("ix_invitations_email"), table_name="invitations")
    op.drop_table("invitations")

    op.drop_constraint("fk_users_company_id", "users", type_="foreignkey")
    op.drop_column("users", "email_verified")
    op.drop_column("users", "is_active")
    op.drop_column("users", "company_id")

    op.drop_table("companies")

    op.execute("DROP TYPE IF EXISTS invitation_status")
    op.execute("DROP TYPE IF EXISTS invite_role")
