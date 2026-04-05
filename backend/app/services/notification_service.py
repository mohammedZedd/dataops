"""Service de notifications pour les événements métier."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User, UserRole


def notify_staff(
    db: Session,
    company_id: str,
    type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    client_id: Optional[str] = None,
    document_id: Optional[str] = None,
) -> None:
    """Create a notification for all ADMIN and ACCOUNTANT users in the company."""
    recipients = db.scalars(
        select(User).where(
            User.company_id == company_id,
            User.role.in_([UserRole.ADMIN, UserRole.ACCOUNTANT]),
            User.is_active == True,
        )
    ).all()

    for u in recipients:
        db.add(Notification(
            company_id=company_id,
            recipient_id=u.id,
            type=type,
            title=title,
            message=message,
            link=link,
            client_id=client_id,
            document_id=document_id,
        ))
    db.flush()
