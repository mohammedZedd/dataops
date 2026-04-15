from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.client_note import ClientTask, TaskComment, ClientNote
from app.models.client import Client
from app.models.user import User, UserRole
from app.services.notification_service import notify_users

router = APIRouter(prefix="/clients", tags=["tasks-notes"])
global_router = APIRouter(tags=["tasks-notes-global"])

_MONTH_NAMES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
_VALID_TYPES = {'envoyer_document', 'appeler_client', 'relance_paiement', 'reunion',
                'validation_facture', 'declaration_fiscale', 'bilan_annuel', 'autre'}
_VALID_PRIORITIES = {'low', 'normal', 'high', 'urgent'}
_VALID_STATUSES = {'todo', 'in_progress', 'done', 'cancelled'}


def _check_staff(current_user: User):
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Réservé au cabinet.")


def _user_brief(u: User | None):
    if not u:
        return None
    name = f"{u.first_name} {u.last_name}"
    return {"id": u.id, "name": name, "initials": name[:2].upper(), "role": u.role.value if hasattr(u.role, 'value') else u.role}


def _task_dict(task: ClientTask, assignee: User | None, creator: User | None):
    return {
        "id": task.id, "title": task.title, "description": task.description,
        "task_type": task.task_type,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "due_year": task.due_year, "due_month": task.due_month,
        "status": task.status, "progress": task.progress, "priority": task.priority,
        "comments_count": task.comments_count,
        "assignee": _user_brief(assignee), "created_by": _user_brief(creator),
        "created_at": task.created_at.isoformat(), "updated_at": task.updated_at.isoformat(),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# TASKS
# ═══════════════════════════════════════════════════════════════════════════════

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    task_type: str = "autre"
    due_date: Optional[str] = None
    due_year: Optional[int] = None
    due_month: Optional[int] = None
    priority: str = "normal"
    assigned_to_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[str] = None
    due_date: Optional[str] = None
    due_year: Optional[int] = None
    due_month: Optional[int] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[str] = None


@router.get("/{client_id}/tasks")
def get_tasks(client_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    tasks = db.scalars(
        select(ClientTask).where(ClientTask.client_id == client_id, ClientTask.company_id == current_user.company_id)
        .order_by(ClientTask.due_year.desc(), ClientTask.due_month.desc(), ClientTask.created_at.desc())
    ).all()

    user_ids = list({t.assigned_to_id for t in tasks if t.assigned_to_id} | {t.created_by_id for t in tasks})
    users_map = {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}
    accountants = db.scalars(select(User).where(User.company_id == current_user.company_id, User.role.in_([UserRole.ADMIN, UserRole.ACCOUNTANT]))).all()

    grouped: dict[int, dict[int, list]] = {}
    for task in tasks:
        grouped.setdefault(task.due_year, {}).setdefault(task.due_month, []).append(
            _task_dict(task, users_map.get(task.assigned_to_id), users_map.get(task.created_by_id)))

    result = []
    for year in sorted(grouped.keys(), reverse=True):
        months_data = []
        for month in sorted(grouped[year].keys(), reverse=True):
            mt = grouped[year][month]
            total, done = len(mt), sum(1 for t in mt if t['status'] == 'done')
            months_data.append({"month": month, "month_name": _MONTH_NAMES[month] if 1 <= month <= 12 else str(month), "tasks": mt, "total": total, "done": done, "progress": round(done / total * 100) if total else 0})
        yt = [t for m in grouped[year].values() for t in m]
        yt_total, yt_done = len(yt), sum(1 for t in yt if t['status'] == 'done')
        result.append({"year": year, "months": months_data, "total": yt_total, "done": yt_done, "progress": round(yt_done / yt_total * 100) if yt_total else 0})

    return {"grouped": result, "accountants": [_user_brief(u) for u in accountants]}


@router.post("/{client_id}/tasks", status_code=201)
def create_task(client_id: str, payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Le titre est requis.")
    now = datetime.utcnow()
    due_date, due_year, due_month = None, payload.due_year or now.year, payload.due_month or now.month
    if payload.due_date:
        due_date = datetime.fromisoformat(payload.due_date)
        due_year, due_month = due_date.year, due_date.month
    task = ClientTask(client_id=client_id, company_id=current_user.company_id, title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        task_type=payload.task_type if payload.task_type in _VALID_TYPES else "autre",
        due_date=due_date, due_year=due_year, due_month=due_month, status="todo", progress=0,
        assigned_to_id=payload.assigned_to_id or None, created_by_id=current_user.id,
        priority=payload.priority if payload.priority in _VALID_PRIORITIES else "normal")
    db.add(task); db.commit(); db.refresh(task)
    return _task_dict(task, db.get(User, task.assigned_to_id) if task.assigned_to_id else None, current_user)


@router.patch("/{client_id}/tasks/{task_id}")
def update_task(client_id: str, task_id: str, payload: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    task = db.scalars(select(ClientTask).where(ClientTask.id == task_id, ClientTask.company_id == current_user.company_id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tâche non trouvée.")
    if payload.title is not None: task.title = payload.title.strip()
    if payload.description is not None: task.description = payload.description.strip() or None
    if payload.task_type is not None and payload.task_type in _VALID_TYPES: task.task_type = payload.task_type
    if payload.priority is not None and payload.priority in _VALID_PRIORITIES: task.priority = payload.priority
    prev_assignee_id = task.assigned_to_id
    if payload.assigned_to_id is not None: task.assigned_to_id = payload.assigned_to_id or None
    if payload.due_date is not None:
        if payload.due_date:
            task.due_date = datetime.fromisoformat(payload.due_date); task.due_year = task.due_date.year; task.due_month = task.due_date.month
        else: task.due_date = None
    if payload.due_year is not None: task.due_year = payload.due_year
    if payload.due_month is not None: task.due_month = payload.due_month
    if payload.progress is not None: task.progress = max(0, min(100, payload.progress))
    if payload.status is not None and payload.status in _VALID_STATUSES:
        task.status = payload.status
        if payload.status == 'done': task.progress = 100; task.completed_at = datetime.utcnow()
        elif payload.status == 'in_progress' and task.progress == 0: task.progress = 30
        elif payload.status == 'todo': task.progress = 0; task.completed_at = None
    task.updated_at = datetime.utcnow()

    # Notify new assignee if the assignment changed
    new_assignee_id = task.assigned_to_id
    if (payload.assigned_to_id is not None
            and new_assignee_id
            and new_assignee_id != prev_assignee_id
            and new_assignee_id != current_user.id):
        assigner_name = f"{current_user.first_name} {current_user.last_name}"
        notify_users(
            db=db,
            company_id=current_user.company_id,
            recipient_ids=[new_assignee_id],
            type="task_assigned",
            title=f"Tâche assignée : {task.title[:60]}",
            message=f"{assigner_name} vous a assigné cette tâche.",
            link=f"/tasks",
            client_id=task.client_id,
            task_id=task.id,
        )

    db.commit(); db.refresh(task)
    return _task_dict(task, db.get(User, task.assigned_to_id) if task.assigned_to_id else None, db.get(User, task.created_by_id))


@router.delete("/{client_id}/tasks/{task_id}")
def delete_task(client_id: str, task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    task = db.scalars(select(ClientTask).where(ClientTask.id == task_id, ClientTask.company_id == current_user.company_id)).first()
    if not task: raise HTTPException(status_code=404, detail="Tâche non trouvée.")
    # Delete associated comments
    for c in db.scalars(select(TaskComment).where(TaskComment.task_id == task_id)).all():
        db.delete(c)
    db.delete(task); db.commit()
    return {"status": "deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# TASK COMMENTS
# ═══════════════════════════════════════════════════════════════════════════════

class CommentCreate(BaseModel):
    content: str


@router.get("/{client_id}/tasks/{task_id}/comments")
def get_comments(client_id: str, task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    comments = db.scalars(select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc())).all()
    author_ids = list({c.author_id for c in comments})
    authors = {u.id: u for u in db.scalars(select(User).where(User.id.in_(author_ids))).all()} if author_ids else {}
    result = []
    for c in comments:
        a = authors.get(c.author_id)
        name = f"{a.first_name} {a.last_name}" if a else "?"
        result.append({"id": c.id, "content": c.content, "created_at": c.created_at.isoformat(), "author_name": name, "author_initials": name[:2].upper()})
    return result


@router.post("/{client_id}/tasks/{task_id}/comments", status_code=201)
def add_comment(client_id: str, task_id: str, payload: CommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Commentaire vide.")
    task = db.scalars(select(ClientTask).where(ClientTask.id == task_id, ClientTask.company_id == current_user.company_id)).first()
    if not task: raise HTTPException(status_code=404, detail="Tâche non trouvée.")
    comment = TaskComment(task_id=task_id, author_id=current_user.id, content=payload.content.strip())
    db.add(comment)
    task.comments_count = (task.comments_count or 0) + 1

    # Notify all task participants except the commenter
    participants = {task.created_by_id}
    if task.assigned_to_id:
        participants.add(task.assigned_to_id)
    participants.discard(current_user.id)
    if participants:
        author_name = f"{current_user.first_name} {current_user.last_name}"
        preview = payload.content.strip()[:80]
        notify_users(
            db=db,
            company_id=current_user.company_id,
            recipient_ids=list(participants),
            type="task_comment",
            title=f"Commentaire sur « {task.title[:60]} »",
            message=f"{author_name} : {preview}{'…' if len(payload.content.strip()) > 80 else ''}",
            link=f"/tasks",
            client_id=task.client_id,
            task_id=task.id,
        )

    db.commit(); db.refresh(comment)
    name = f"{current_user.first_name} {current_user.last_name}"
    return {"id": comment.id, "content": comment.content, "created_at": comment.created_at.isoformat(), "author_name": name, "author_initials": name[:2].upper()}


# ═══════════════════════════════════════════════════════════════════════════════
# NOTES (sticky notes)
# ═══════════════════════════════════════════════════════════════════════════════

class NoteCreate(BaseModel):
    title: Optional[str] = None
    content: str
    color: str = "yellow"
    tags: Optional[str] = None
    client_id: Optional[str] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    tags: Optional[str] = None


def _note_dict(note: ClientNote, author: User | None, client: Client | None = None):
    name = f"{author.first_name} {author.last_name}" if author else "?"
    return {
        "id": note.id, "title": note.title, "content": note.content, "color": note.color,
        "is_pinned": note.is_pinned, "tags": note.tags or "",
        "client_id": note.client_id, "client_name": client.name if client else None,
        "created_at": note.created_at.isoformat(), "updated_at": note.updated_at.isoformat(),
        "author": {"id": author.id if author else None, "name": name, "initials": name[:2].upper()},
    }


@router.get("/{client_id}/notes")
def get_notes(client_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    notes = db.scalars(select(ClientNote).where(ClientNote.client_id == client_id, ClientNote.company_id == current_user.company_id).order_by(ClientNote.is_pinned.desc(), ClientNote.updated_at.desc())).all()
    author_ids = list({n.author_id for n in notes})
    authors = {u.id: u for u in db.scalars(select(User).where(User.id.in_(author_ids))).all()} if author_ids else {}
    return [_note_dict(n, authors.get(n.author_id)) for n in notes]


@router.post("/{client_id}/notes", status_code=201)
def create_note(client_id: str, payload: NoteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    if not payload.content.strip(): raise HTTPException(status_code=400, detail="Le contenu est requis.")
    note = ClientNote(client_id=client_id, company_id=current_user.company_id, author_id=current_user.id,
        title=payload.title.strip() if payload.title else None, content=payload.content.strip(),
        color=payload.color if payload.color in ("yellow", "blue", "green", "pink", "gray") else "yellow",
        tags=payload.tags or None)
    db.add(note); db.commit(); db.refresh(note)
    return _note_dict(note, current_user, db.get(Client, note.client_id))


@router.patch("/{client_id}/notes/{note_id}")
def update_note(client_id: str, note_id: str, payload: NoteUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    note = db.scalars(select(ClientNote).where(ClientNote.id == note_id, ClientNote.company_id == current_user.company_id)).first()
    if not note: raise HTTPException(status_code=404, detail="Note non trouvée.")
    if payload.title is not None: note.title = payload.title.strip() or None
    if payload.content is not None: note.content = payload.content.strip()
    if payload.color is not None and payload.color in ("yellow", "blue", "green", "pink", "gray"): note.color = payload.color
    if payload.tags is not None: note.tags = payload.tags or None
    note.updated_at = datetime.utcnow(); db.commit(); db.refresh(note)
    return _note_dict(note, db.get(User, note.author_id), db.get(Client, note.client_id))


@router.patch("/{client_id}/notes/{note_id}/pin")
def toggle_pin(client_id: str, note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    note = db.scalars(select(ClientNote).where(ClientNote.id == note_id, ClientNote.company_id == current_user.company_id)).first()
    if not note: raise HTTPException(status_code=404, detail="Note non trouvée.")
    note.is_pinned = not note.is_pinned; note.updated_at = datetime.utcnow(); db.commit()
    return {"is_pinned": note.is_pinned}


@router.delete("/{client_id}/notes/{note_id}")
def delete_note(client_id: str, note_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    note = db.scalars(select(ClientNote).where(ClientNote.id == note_id, ClientNote.company_id == current_user.company_id)).first()
    if not note: raise HTTPException(status_code=404, detail="Note non trouvée.")
    db.delete(note); db.commit()
    return {"status": "deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL endpoints (company-wide) — for Tâches and Notes pages
# ═══════════════════════════════════════════════════════════════════════════════

@global_router.get("/tasks")
def list_all_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    tasks = db.scalars(
        select(ClientTask).where(ClientTask.company_id == current_user.company_id)
        .order_by(ClientTask.due_date.is_(None), ClientTask.due_date.asc(), ClientTask.created_at.desc())
    ).all()

    user_ids = list({t.assigned_to_id for t in tasks if t.assigned_to_id} | {t.created_by_id for t in tasks})
    users_map = {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}
    client_ids = list({t.client_id for t in tasks if t.client_id})
    clients_map = {c.id: c for c in db.scalars(select(Client).where(Client.id.in_(client_ids))).all()} if client_ids else {}

    accountants = db.scalars(select(User).where(User.company_id == current_user.company_id, User.role.in_([UserRole.ADMIN, UserRole.ACCOUNTANT]))).all()
    all_clients = db.scalars(select(Client).where(Client.company_id == current_user.company_id)).all()

    items = []
    for t in tasks:
        d = _task_dict(t, users_map.get(t.assigned_to_id), users_map.get(t.created_by_id))
        c = clients_map.get(t.client_id)
        d["client_id"] = t.client_id
        d["client_name"] = c.name if c else None
        items.append(d)

    return {
        "tasks": items,
        "accountants": [_user_brief(u) for u in accountants],
        "clients": [{"id": c.id, "name": c.name} for c in all_clients],
    }


@global_router.get("/notes")
def list_all_notes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    notes = db.scalars(
        select(ClientNote).where(ClientNote.company_id == current_user.company_id)
        .order_by(ClientNote.is_pinned.desc(), ClientNote.updated_at.desc())
    ).all()
    author_ids = list({n.author_id for n in notes})
    authors = {u.id: u for u in db.scalars(select(User).where(User.id.in_(author_ids))).all()} if author_ids else {}
    client_ids = list({n.client_id for n in notes if n.client_id})
    clients_map = {c.id: c for c in db.scalars(select(Client).where(Client.id.in_(client_ids))).all()} if client_ids else {}
    all_clients = db.scalars(select(Client).where(Client.company_id == current_user.company_id)).all()
    return {
        "notes": [_note_dict(n, authors.get(n.author_id), clients_map.get(n.client_id)) for n in notes],
        "clients": [{"id": c.id, "name": c.name} for c in all_clients],
    }
