from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifs = db.scalars(
        select(Notification)
        .where(Notification.recipient_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    ).all()

    unread = sum(1 for n in notifs if not n.is_read)

    return {
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifs
        ],
        "unread_count": unread,
    }


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.get(Notification, notification_id)
    if n and n.recipient_id == current_user.id:
        n.is_read = True
        db.commit()
    return {"status": "ok"}


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.execute(
        update(Notification)
        .where(Notification.recipient_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    db.commit()
    return {"status": "ok"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.get(Notification, notification_id)
    if n and n.recipient_id == current_user.id:
        db.delete(n)
        db.commit()
    return {"status": "ok"}
