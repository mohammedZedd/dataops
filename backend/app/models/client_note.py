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

    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    due_year: Mapped[int] = mapped_column(Integer, nullable=False)
    due_month: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[str] = mapped_column(String(20), default="todo", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    assigned_to_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)

    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String, ForeignKey("client_tasks.id"), nullable=False)
    author_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ClientNote(Base):
    __tablename__ = "client_notes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id: Mapped[str] = mapped_column(String, ForeignKey("clients.id"), nullable=False)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    author_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="yellow", nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tags: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # comma-separated
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
