from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.client_note import ClientNote
from app.models.user import User, UserRole

router = APIRouter(prefix="/clients", tags=["notes"])


class NoteCreate(BaseModel):
    title: Optional[str] = None
    content: str
    color: str = "yellow"


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None


def _check_staff(current_user: User):
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Réservé au cabinet.")


def _note_dict(note: ClientNote, author: User | None):
    name = f"{author.first_name} {author.last_name}" if author else "?"
    initials = name[:2].upper() if name else "?"
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "color": note.color,
        "is_pinned": note.is_pinned,
        "created_at": note.created_at.isoformat(),
        "updated_at": note.updated_at.isoformat(),
        "author": {"id": author.id if author else None, "name": name, "initials": initials},
    }


@router.get("/{client_id}/notes")
def get_notes(client_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    notes = db.scalars(
        select(ClientNote)
        .where(ClientNote.client_id == client_id, ClientNote.company_id == current_user.company_id)
        .order_by(ClientNote.is_pinned.desc(), ClientNote.updated_at.desc())
    ).all()

    result = []
    # Batch-load authors
    author_ids = list({n.author_id for n in notes})
    authors = {u.id: u for u in db.scalars(select(User).where(User.id.in_(author_ids))).all()} if author_ids else {}
    for note in notes:
        result.append(_note_dict(note, authors.get(note.author_id)))
    return result


@router.post("/{client_id}/notes", status_code=201)
def create_note(client_id: str, payload: NoteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Le contenu est requis.")
    note = ClientNote(
        client_id=client_id,
        company_id=current_user.company_id,
        author_id=current_user.id,
        title=payload.title.strip() if payload.title else None,
        content=payload.content.strip(),
        color=payload.color if payload.color in ("yellow", "blue", "green", "pink", "gray") else "yellow",
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_dict(note, current_user)


@router.patch("/{client_id}/notes/{note_id}")
def update_note(client_id: str, note_id: str, payload: NoteUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    note = db.scalars(select(ClientNote).where(ClientNote.id == note_id, ClientNote.company_id == current_user.company_id)).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note non trouvée.")
    if payload.title is not None:
        note.title = payload.title.strip() or None
    if payload.content is not None:
        note.content = payload.content.strip()
    if payload.color is not None and payload.color in ("yellow", "blue", "green", "pink", "gray"):
        note.color = payload.color
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return _note_dict(note, db.get(User, note.author_id))


@router.patch("/{client_id}/notes/{note_id}/pin")
def toggle_pin(client_id: str, note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    note = db.scalars(select(ClientNote).where(ClientNote.id == note_id, ClientNote.company_id == current_user.company_id)).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note non trouvée.")
    note.is_pinned = not note.is_pinned
    note.updated_at = datetime.utcnow()
    db.commit()
    return {"is_pinned": note.is_pinned}


@router.delete("/{client_id}/notes/{note_id}")
def delete_note(client_id: str, note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    note = db.scalars(select(ClientNote).where(ClientNote.id == note_id, ClientNote.company_id == current_user.company_id)).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note non trouvée.")
    db.delete(note)
    db.commit()
    return {"status": "deleted"}
