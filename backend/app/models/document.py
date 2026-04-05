import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    client_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("clients.id", ondelete="CASCADE"), nullable=True
    )
    uploaded_by_user_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    doc_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    status: Mapped[str] = mapped_column(
        SAEnum("uploaded", "processing", "processed", "error", name="document_status"),
        default="uploaded",
        nullable=False,
    )

    client: Mapped[Optional["Client"]] = relationship("Client", back_populates="documents")  # noqa: F821
    invoice: Mapped[Optional["Invoice"]] = relationship(  # noqa: F821
        "Invoice", back_populates="document", uselist=False, cascade="all, delete-orphan"
    )
