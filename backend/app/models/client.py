import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    secteur_activite: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    regime_fiscal: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    forme_juridique: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ice: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    if_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    rc: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tp: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cnss: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document", back_populates="client", cascade="all, delete-orphan"
    )
