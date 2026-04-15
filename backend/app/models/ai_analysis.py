"""AI accounting models — analyses and resulting journal entries."""
import uuid
from datetime import datetime
from typing import Optional, Any

from sqlalchemy import String, DateTime, ForeignKey, Float, Boolean, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), unique=True, nullable=False)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)

    # AI results
    document_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    extraction_data: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    accounting_entries: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    tva_details: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    alerts: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    suggestions: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    # Status
    # pending | processing | done | failed | validated
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)

    # Validation
    validated_by_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    corrections: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    document_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("documents.id"), nullable=True)
    ai_analysis_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("ai_analyses.id"), nullable=True)
    client_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("clients.id"), nullable=True)

    # achats | ventes | banque | caisse | operations_diverses
    journal_type: Mapped[str] = mapped_column(String(30), nullable=False)
    entry_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    entry_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    compte_debit: Mapped[str] = mapped_column(String(20), nullable=False)
    libelle_debit: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    compte_credit: Mapped[str] = mapped_column(String(20), nullable=False)
    libelle_credit: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    montant: Mapped[float] = mapped_column(Float, default=0, nullable=False)

    is_validated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
