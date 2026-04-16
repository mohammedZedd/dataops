from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.client import Client
from app.models.document import Document
from app.models.invoice import Invoice
from app.models.user import User, UserRole

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cid = current_user.company_id
    now = datetime.utcnow()
    som = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_som = (som - timedelta(days=1)).replace(day=1)

    # Clients
    total_clients = db.scalar(select(func.count(Client.id)).where(Client.company_id == cid)) or 0
    new_clients = db.scalar(select(func.count(Client.id)).where(Client.company_id == cid, Client.created_at >= som)) or 0

    # Documents
    base_docs = select(func.count(Document.id)).join(Client, Document.client_id == Client.id).where(Client.company_id == cid)
    docs_month = db.scalar(base_docs.where(Document.uploaded_at >= som)) or 0
    docs_prev = db.scalar(base_docs.where(Document.uploaded_at >= prev_som, Document.uploaded_at < som)) or 0

    # Invoices
    base_inv = select(func.count(Invoice.id)).join(Document, Invoice.document_id == Document.id).join(Client, Document.client_id == Client.id).where(Client.company_id == cid)
    total_inv = db.scalar(base_inv) or 0
    validated = db.scalar(base_inv.where(Invoice.status == "validated")) or 0
    to_review = db.scalar(base_inv.where(Invoice.status == "to_review")) or 0
    rejected = db.scalar(base_inv.where(Invoice.status == "rejected")) or 0
    rate = round(validated / total_inv * 100) if total_inv > 0 else 0

    # Monthly tracking
    inv_month = select(func.count(Invoice.id)).join(Document, Invoice.document_id == Document.id).join(Client, Document.client_id == Client.id).where(Client.company_id == cid, Document.uploaded_at >= som)
    processing = db.scalar(inv_month) or 0
    val_month = db.scalar(inv_month.where(Invoice.status == "validated")) or 0

    # Recent activity (last 5 docs)
    recent_docs = db.execute(
        select(Document, Client.name).join(Client, Document.client_id == Client.id).where(Client.company_id == cid).order_by(Document.uploaded_at.desc()).limit(5)
    ).all()
    activity = [{"client_name": r[1], "description": r[0].file_name, "time": r[0].uploaded_at.isoformat()} for r in recent_docs]

    # Invoices to validate
    inv_rows = db.execute(
        select(Invoice, Client.name).join(Document, Invoice.document_id == Document.id).join(Client, Document.client_id == Client.id).where(Client.company_id == cid, Invoice.status == "to_review").order_by(Invoice.id.desc()).limit(5)
    ).all()
    inv_list = [{"id": r[0].id, "invoice_number": r[0].invoice_number, "supplier_name": r[0].supplier_name, "total_amount": float(r[0].total_amount), "client_name": r[1], "direction": r[0].direction} for r in inv_rows]

    month_label = now.strftime("%B %Y")

    return {
        "period": {"month": month_label, "label": f"1 – {now.day} {month_label.lower()}"},
        "clients": {"total": total_clients, "new_this_month": new_clients},
        "documents": {"this_month": docs_month, "prev_month": docs_prev, "diff": docs_month - docs_prev},
        "invoices": {"total": total_inv, "validated": validated, "to_review": to_review, "rejected": rejected, "validation_rate": rate},
        "monthly_tracking": {
            "reception": {"count": docs_month, "status": "completed" if docs_month > 0 else "pending"},
            "processing": {"count": processing, "status": "completed" if docs_month > 0 and processing >= docs_month * 0.8 else "in_progress" if processing > 0 else "pending"},
            "validation": {"count": val_month, "status": "completed" if processing > 0 and val_month >= processing else "in_progress" if val_month > 0 else "pending"},
        },
        "recent_activity": activity,
        "invoices_to_validate": inv_list,
    }


@router.get("/client-stats")
def get_client_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from fastapi import HTTPException
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Réservé aux clients.")
    client_id = current_user.client_id
    if not client_id:
        return {"documents": {"total": 0, "this_month": 0, "pending": 0}, "invoices": {"total": 0, "validated": 0, "to_review": 0, "rejected": 0}, "recent_documents": [], "unread_messages": 0}

    now = datetime.utcnow()
    som = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    base_docs = select(func.count(Document.id)).where(Document.client_id == client_id)
    total_docs = db.scalar(base_docs) or 0
    docs_month = db.scalar(base_docs.where(Document.uploaded_at >= som)) or 0
    pending = db.scalar(base_docs.where(Document.status.in_(["uploaded", "processing"]))) or 0

    base_inv = select(func.count(Invoice.id)).join(Document, Invoice.document_id == Document.id).where(Document.client_id == client_id)
    total_inv = db.scalar(base_inv) or 0
    validated = db.scalar(base_inv.where(Invoice.status == "validated")) or 0
    to_review = db.scalar(base_inv.where(Invoice.status == "to_review")) or 0
    rejected = db.scalar(base_inv.where(Invoice.status == "rejected")) or 0

    recent = db.execute(select(Document).where(Document.client_id == client_id).order_by(Document.uploaded_at.desc()).limit(5)).scalars().all()
    recent_list = []
    for d in recent:
        inv = db.scalars(select(Invoice).where(Invoice.document_id == d.id)).first()
        recent_list.append({"id": d.id, "filename": d.file_name, "status": d.status, "created_at": d.uploaded_at.isoformat(), "invoice_status": inv.status if inv else None})

    # Unread messages
    from app.models.conversation import Conversation, Message
    conv = db.scalars(select(Conversation).where(Conversation.client_user_id == current_user.id)).first()
    unread = 0
    if conv:
        unread = sum(1 for _ in db.scalars(select(Message).where(Message.conversation_id == conv.id, Message.sender_id != current_user.id, Message.is_read == False)).all())

    return {
        "documents": {"total": total_docs, "this_month": docs_month, "pending": pending},
        "invoices": {"total": total_inv, "validated": validated, "to_review": to_review, "rejected": rejected},
        "recent_documents": recent_list,
        "unread_messages": unread,
    }
