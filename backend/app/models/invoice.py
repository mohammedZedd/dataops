import uuid

from sqlalchemy import String, Date, Numeric, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    document_id: Mapped[str] = mapped_column(
        String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)  # ISO 8601 : "YYYY-MM-DD"
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    vat_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        SAEnum("to_review", "validated", "rejected", name="invoice_status"),
        default="to_review",
        nullable=False,
    )

    document: Mapped["Document"] = relationship("Document", back_populates="invoice")  # noqa: F821
