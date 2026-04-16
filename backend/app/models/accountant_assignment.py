import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AccountantClientAssignment(Base):
    """Relation directe comptable ↔ client.

    Un comptable peut être assigné à plusieurs clients,
    un client peut être suivi par plusieurs comptables.
    """
    __tablename__ = "accountant_client_assignments"
    __table_args__ = (
        UniqueConstraint("accountant_id", "client_id", name="uq_accountant_client"),
    )

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    accountant_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[str] = mapped_column(
        String, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[str] = mapped_column(
        String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
