from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.client_note import ClientTask
from app.models.client import Client
from app.models.user import User, UserRole

router = APIRouter(prefix="/team", tags=["team"])


def _check_admin(current_user: User):
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Réservé au cabinet.")


def _role_label(role) -> str:
    val = role.value if hasattr(role, "value") else role
    return {"admin": "Administrateur", "accountant": "Comptable"}.get(val, str(val))


def _member_dict(u: User, tasks: list[ClientTask], client_ids: set[str]):
    in_progress = sum(1 for t in tasks if t.status in ("todo", "in_progress"))
    done = sum(1 for t in tasks if t.status == "done")
    overdue = sum(1 for t in tasks if t.due_date and t.due_date < datetime.utcnow() and t.status not in ("done", "cancelled"))
    total = len(tasks)
    name = f"{u.first_name} {u.last_name}"

    # Workload indicator: red if overdue, orange if many in_progress, green otherwise
    if overdue > 0:
        workload = "red"
    elif in_progress > 8:
        workload = "orange"
    else:
        workload = "green"

    return {
        "id": u.id,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "name": name,
        "initials": name[:2].upper() if name else "?",
        "email": u.email,
        "phone": u.phone_number,
        "role": u.role.value if hasattr(u.role, "value") else u.role,
        "role_label": _role_label(u.role),
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat(),
        "last_seen": u.updated_at.isoformat() if u.updated_at else None,
        "clients_count": len(client_ids),
        "tasks_total": total,
        "tasks_in_progress": in_progress,
        "tasks_done": done,
        "tasks_overdue": overdue,
        "workload": workload,
    }


@router.get("")
def list_team(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_admin(current_user)
    members = db.scalars(
        select(User).where(
            User.company_id == current_user.company_id,
            User.role.in_([UserRole.ADMIN, UserRole.ACCOUNTANT]),
        ).order_by(User.first_name)
    ).all()

    # Batch-load all tasks for the company
    all_tasks = db.scalars(select(ClientTask).where(ClientTask.company_id == current_user.company_id)).all()
    by_user: dict[str, list[ClientTask]] = {}
    clients_by_user: dict[str, set[str]] = {}
    for t in all_tasks:
        if t.assigned_to_id:
            by_user.setdefault(t.assigned_to_id, []).append(t)
            if t.client_id:
                clients_by_user.setdefault(t.assigned_to_id, set()).add(t.client_id)

    items = [_member_dict(u, by_user.get(u.id, []), clients_by_user.get(u.id, set())) for u in members]

    # Aggregate metrics
    total_active = sum(1 for u in members if u.is_active)
    total_clients = len({cid for s in clients_by_user.values() for cid in s})
    total_in_progress = sum(m["tasks_in_progress"] for m in items)
    total_overdue = sum(m["tasks_overdue"] for m in items)

    return {
        "members": items,
        "metrics": {
            "active_count": total_active,
            "clients_count": total_clients,
            "tasks_in_progress": total_in_progress,
            "tasks_overdue": total_overdue,
        },
    }


@router.get("/{user_id}")
def team_detail(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_admin(current_user)
    u = db.scalars(
        select(User).where(
            User.id == user_id,
            User.company_id == current_user.company_id,
            User.role.in_([UserRole.ADMIN, UserRole.ACCOUNTANT]),
        )
    ).first()
    if not u:
        raise HTTPException(status_code=404, detail="Membre introuvable.")

    tasks = db.scalars(select(ClientTask).where(ClientTask.assigned_to_id == user_id, ClientTask.company_id == current_user.company_id)).all()

    # Assigned clients (derived from tasks)
    client_ids = list({t.client_id for t in tasks if t.client_id})
    clients_map = {c.id: c for c in db.scalars(select(Client).where(Client.id.in_(client_ids))).all()} if client_ids else {}

    clients_data = []
    for cid in client_ids:
        c = clients_map.get(cid)
        if not c:
            continue
        c_tasks = [t for t in tasks if t.client_id == cid]
        open_count = sum(1 for t in c_tasks if t.status in ("todo", "in_progress"))
        last_activity = max((t.updated_at for t in c_tasks), default=None)
        clients_data.append({
            "id": c.id,
            "name": c.name,
            "open_tasks": open_count,
            "total_tasks": len(c_tasks),
            "last_activity": last_activity.isoformat() if last_activity else None,
        })
    clients_data.sort(key=lambda x: x["open_tasks"], reverse=True)

    # Tasks list
    tasks_list = []
    for t in tasks:
        c = clients_map.get(t.client_id) if t.client_id else None
        tasks_list.append({
            "id": t.id,
            "title": t.title,
            "task_type": t.task_type,
            "status": t.status,
            "priority": t.priority,
            "progress": t.progress,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "client_id": t.client_id,
            "client_name": c.name if c else None,
            "created_at": t.created_at.isoformat(),
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "is_overdue": bool(t.due_date and t.due_date < datetime.utcnow() and t.status not in ("done", "cancelled")),
        })

    # Performance — completions per week (last 8 weeks)
    now = datetime.utcnow()
    weeks = []
    for i in range(7, -1, -1):
        start = now - timedelta(days=(i + 1) * 7)
        end = now - timedelta(days=i * 7)
        count = sum(1 for t in tasks if t.completed_at and start <= t.completed_at < end)
        weeks.append({"label": start.strftime("%d/%m"), "count": count})

    done_tasks = [t for t in tasks if t.status == "done"]
    on_time = sum(1 for t in done_tasks if t.completed_at and t.due_date and t.completed_at <= t.due_date)
    completion_rate = round((on_time / len(done_tasks)) * 100) if done_tasks else 0

    # Avg processing time (days between created_at and completed_at)
    processed = [(t.completed_at - t.created_at).days for t in done_tasks if t.completed_at]
    avg_days = round(sum(processed) / len(processed), 1) if processed else 0

    # Activity timeline (derived from tasks)
    activity = []
    for t in tasks:
        c = clients_map.get(t.client_id) if t.client_id else None
        client_name = c.name if c else "—"
        activity.append({"type": "task_created", "at": t.created_at.isoformat(), "label": f"Tâche créée: {t.title}", "client_name": client_name})
        if t.completed_at:
            activity.append({"type": "task_completed", "at": t.completed_at.isoformat(), "label": f"Tâche terminée: {t.title}", "client_name": client_name})
    activity.sort(key=lambda x: x["at"], reverse=True)
    activity = activity[:20]

    return {
        "member": _member_dict(u, tasks, set(client_ids)),
        "clients": clients_data,
        "tasks": tasks_list,
        "performance": {
            "weeks": weeks,
            "completion_rate": completion_rate,
            "avg_processing_days": avg_days,
            "total_done": len(done_tasks),
        },
        "activity": activity,
    }


@router.patch("/{user_id}/active")
def toggle_active(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _check_admin(current_user)
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs.")
    u = db.scalars(select(User).where(User.id == user_id, User.company_id == current_user.company_id)).first()
    if not u:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    if u.id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous désactiver vous-même.")
    u.is_active = not u.is_active
    db.commit()
    return {"is_active": u.is_active}
