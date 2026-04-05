from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.conversation import Conversation, Message
from app.models.client import Client
from app.models.user import User, UserRole
from app.services import notification_service

router = APIRouter(prefix="/chat", tags=["chat"])


class SendMessageRequest(BaseModel):
    content: str
    message_type: str = "text"
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    document_id: Optional[str] = None


def _conv_dict(conv: Conversation, last_msg: Message | None, unread: int, client: Client | None, client_user: User | None):
    return {
        "id": conv.id, "company_id": conv.company_id, "client_id": conv.client_id,
        "client_user_id": conv.client_user_id, "status": conv.status,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "created_at": conv.created_at.isoformat(),
        "last_message": {"id": last_msg.id, "content": last_msg.content, "sender_role": last_msg.sender_role, "created_at": last_msg.created_at.isoformat()} if last_msg else None,
        "unread_count": unread,
        "client_name": f"{client_user.first_name} {client_user.last_name}" if client_user else (client.name if client else None),
        "client_company": client.name if client else None,
    }


@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.CLIENT:
        convs = db.scalars(select(Conversation).where(Conversation.client_user_id == current_user.id).order_by(Conversation.last_message_at.desc())).all()
    else:
        convs = db.scalars(select(Conversation).where(Conversation.company_id == current_user.company_id).order_by(Conversation.last_message_at.desc())).all()

    result = []
    for c in convs:
        last = db.scalars(select(Message).where(Message.conversation_id == c.id).order_by(Message.created_at.desc()).limit(1)).first()
        unread = sum(1 for m in db.scalars(select(Message).where(Message.conversation_id == c.id, Message.sender_id != current_user.id, Message.is_read == False)).all())
        client = db.get(Client, c.client_id) if c.client_id else None
        client_user = db.scalars(select(User).where(User.id == c.client_user_id)).first()
        result.append(_conv_dict(c, last, unread, client, client_user))
    return {"conversations": result, "total": len(result)}


@router.post("/conversations")
def create_conversation(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Réservé aux clients.")
    existing = db.scalars(select(Conversation).where(Conversation.client_user_id == current_user.id, Conversation.status == "open")).first()
    if existing:
        return {"id": existing.id, "status": existing.status}
    conv = Conversation(company_id=current_user.company_id, client_id=current_user.client_id, client_user_id=current_user.id, last_message_at=datetime.utcnow())
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"id": conv.id, "status": conv.status}


@router.get("/conversations/{conv_id}/messages")
def get_messages(conv_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    if current_user.role == UserRole.CLIENT and conv.client_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    if current_user.role != UserRole.CLIENT and conv.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")

    msgs = db.scalars(select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at.asc())).all()
    # Mark as read
    db.execute(update(Message).where(Message.conversation_id == conv_id, Message.sender_id != current_user.id, Message.is_read == False).values(is_read=True))
    db.commit()

    return {"messages": [{"id": m.id, "conversation_id": m.conversation_id, "sender_id": m.sender_id, "sender_role": m.sender_role, "content": m.content, "message_type": m.message_type, "file_name": m.file_name, "file_url": m.file_url, "document_id": m.document_id, "is_read": m.is_read, "created_at": m.created_at.isoformat()} for m in msgs]}


@router.post("/conversations/{conv_id}/messages")
def send_message(conv_id: str, payload: SendMessageRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Message vide.")

    msg = Message(conversation_id=conv_id, sender_id=current_user.id, sender_role=current_user.role.value if hasattr(current_user.role, 'value') else current_user.role, content=payload.content.strip(), message_type=payload.message_type, file_name=payload.file_name, file_url=payload.file_url, document_id=payload.document_id)
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    # Notify
    if current_user.role == UserRole.CLIENT:
        notification_service.notify_staff(db, company_id=conv.company_id, type="new_message", title="Nouveau message", message=f"{current_user.first_name} {current_user.last_name}: {msg.content[:60]}", link=f"/chat?conversation={conv_id}", client_id=conv.client_id)
        db.commit()

    return {"id": msg.id, "conversation_id": msg.conversation_id, "sender_id": msg.sender_id, "sender_role": msg.sender_role, "content": msg.content, "message_type": msg.message_type, "file_name": msg.file_name, "file_url": msg.file_url, "document_id": msg.document_id, "is_read": msg.is_read, "created_at": msg.created_at.isoformat()}


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.CLIENT:
        conv_ids = [c.id for c in db.scalars(select(Conversation).where(Conversation.client_user_id == current_user.id)).all()]
    else:
        conv_ids = [c.id for c in db.scalars(select(Conversation).where(Conversation.company_id == current_user.company_id)).all()]
    if not conv_ids:
        return {"unread_count": 0}
    count = sum(1 for _ in db.scalars(select(Message).where(Message.conversation_id.in_(conv_ids), Message.sender_id != current_user.id, Message.is_read == False)).all())
    return {"unread_count": count}
