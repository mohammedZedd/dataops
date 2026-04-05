from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.client_note import ClientTask
from app.models.user import User, UserRole

router = APIRouter(prefix="/clients", tags=["tasks"])

_MONTH_NAMES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

_VALID_TYPES = {'envoyer_document', 'appeler_client', 'relance_paiement', 'reunion',
                'validation_facture', 'declaration_fiscale', 'bilan_annuel', 'autre'}
_VALID_PRIORITIES = {'low', 'normal', 'high', 'urgent'}
_VALID_STATUSES = {'todo', 'in_progress', 'done', 'cancelled'}


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
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "task_type": task.task_type,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "due_year": task.due_year,
        "due_month": task.due_month,
        "status": task.status,
        "progress": task.progress,
        "priority": task.priority,
        "assignee": _user_brief(assignee),
        "created_by": _user_brief(creator),
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


@router.get("/{client_id}/tasks")
def get_tasks(client_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    tasks = db.scalars(
        select(ClientTask)
        .where(ClientTask.client_id == client_id, ClientTask.company_id == current_user.company_id)
        .order_by(ClientTask.due_year.desc(), ClientTask.due_month.desc(), ClientTask.created_at.desc())
    ).all()

    # Batch-load users
    user_ids = list({t.assigned_to_id for t in tasks if t.assigned_to_id} | {t.created_by_id for t in tasks})
    users_map = {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}

    # Get accountants for assignment dropdown
    accountants = db.scalars(
        select(User).where(User.company_id == current_user.company_id, User.role.in_([UserRole.ADMIN, UserRole.ACCOUNTANT]))
    ).all()

    # Group by year → month
    grouped: dict[int, dict[int, list]] = {}
    for task in tasks:
        y = task.due_year
        m = task.due_month
        grouped.setdefault(y, {}).setdefault(m, []).append(
            _task_dict(task, users_map.get(task.assigned_to_id), users_map.get(task.created_by_id))
        )

    result = []
    for year in sorted(grouped.keys(), reverse=True):
        months_data = []
        for month in sorted(grouped[year].keys(), reverse=True):
            month_tasks = grouped[year][month]
            total = len(month_tasks)
            done = sum(1 for t in month_tasks if t['status'] == 'done')
            months_data.append({
                "month": month,
                "month_name": _MONTH_NAMES[month] if 1 <= month <= 12 else str(month),
                "tasks": month_tasks,
                "total": total,
                "done": done,
                "progress": round(done / total * 100) if total > 0 else 0,
            })
        year_tasks = [t for m in grouped[year].values() for t in m]
        year_total = len(year_tasks)
        year_done = sum(1 for t in year_tasks if t['status'] == 'done')
        result.append({
            "year": year,
            "months": months_data,
            "total": year_total,
            "done": year_done,
            "progress": round(year_done / year_total * 100) if year_total > 0 else 0,
        })

    return {
        "grouped": result,
        "accountants": [_user_brief(u) for u in accountants],
    }


@router.post("/{client_id}/tasks", status_code=201)
def create_task(client_id: str, payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Le titre est requis.")

    now = datetime.utcnow()
    due_date = None
    due_year = payload.due_year or now.year
    due_month = payload.due_month or now.month

    if payload.due_date:
        due_date = datetime.fromisoformat(payload.due_date)
        due_year = due_date.year
        due_month = due_date.month

    task = ClientTask(
        client_id=client_id,
        company_id=current_user.company_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        task_type=payload.task_type if payload.task_type in _VALID_TYPES else "autre",
        due_date=due_date,
        due_year=due_year,
        due_month=due_month,
        status="todo",
        progress=0,
        assigned_to_id=payload.assigned_to_id or None,
        created_by_id=current_user.id,
        priority=payload.priority if payload.priority in _VALID_PRIORITIES else "normal",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    assignee = db.get(User, task.assigned_to_id) if task.assigned_to_id else None
    return _task_dict(task, assignee, current_user)


@router.patch("/{client_id}/tasks/{task_id}")
def update_task(client_id: str, task_id: str, payload: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    task = db.scalars(select(ClientTask).where(ClientTask.id == task_id, ClientTask.company_id == current_user.company_id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tâche non trouvée.")

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description.strip() or None
    if payload.task_type is not None and payload.task_type in _VALID_TYPES:
        task.task_type = payload.task_type
    if payload.priority is not None and payload.priority in _VALID_PRIORITIES:
        task.priority = payload.priority
    if payload.assigned_to_id is not None:
        task.assigned_to_id = payload.assigned_to_id or None
    if payload.due_date is not None:
        if payload.due_date:
            task.due_date = datetime.fromisoformat(payload.due_date)
            task.due_year = task.due_date.year
            task.due_month = task.due_date.month
        else:
            task.due_date = None
    if payload.due_year is not None:
        task.due_year = payload.due_year
    if payload.due_month is not None:
        task.due_month = payload.due_month
    if payload.progress is not None:
        task.progress = max(0, min(100, payload.progress))

    # Status change with auto-progress
    if payload.status is not None and payload.status in _VALID_STATUSES:
        task.status = payload.status
        if payload.status == 'done':
            task.progress = 100
            task.completed_at = datetime.utcnow()
        elif payload.status == 'in_progress' and task.progress == 0:
            task.progress = 30
        elif payload.status == 'todo':
            task.progress = 0
            task.completed_at = None

    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    assignee = db.get(User, task.assigned_to_id) if task.assigned_to_id else None
    creator = db.get(User, task.created_by_id)
    return _task_dict(task, assignee, creator)


@router.delete("/{client_id}/tasks/{task_id}")
def delete_task(client_id: str, task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_staff(current_user)
    task = db.scalars(select(ClientTask).where(ClientTask.id == task_id, ClientTask.company_id == current_user.company_id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tâche non trouvée.")
    db.delete(task)
    db.commit()
    return {"status": "deleted"}
