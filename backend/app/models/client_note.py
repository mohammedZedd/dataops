import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ClientTask(Base):
    __tablename__ = "client_tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id: Mapped[str] = mapped_column(String, ForeignKey("clients.id"), nullable=False)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # envoyer_document | appeler_client | relance_paiement | reunion |
    # validation_facture | declaration_fiscale | bilan_annuel | autre

    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    due_year: Mapped[int] = mapped_column(Integer, nullable=False)
    due_month: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[str] = mapped_column(String(20), default="todo", nullable=False)
    # todo | in_progress | done | cancelled
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    assigned_to_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    # low | normal | high | urgent

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
