from datetime import datetime, timedelta
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.invitation import Invitation, InvitationStatus
from app.models.user import User
from app.schemas.invitation import InvitationAccountantCreate, InvitationClientCreate
from app.models.user import UserRole


def _now() -> datetime:
    return datetime.utcnow()


def _expires_at() -> datetime:
    return _now() + timedelta(hours=settings.INVITE_EXPIRE_HOURS)


def _generate_token(db: Session) -> str:
    # Very low collision risk; check DB to be safe.
    for _ in range(5):
        token = secrets.token_urlsafe(32)
        exists = db.scalar(select(Invitation).where(Invitation.token == token))
        if not exists:
            return token
    return secrets.token_urlsafe(48)


def get_by_token(db: Session, token: str) -> Invitation | None:
    return db.scalar(select(Invitation).where(Invitation.token == token))


def list_by_company(db: Session, company_id: str) -> list[Invitation]:
    return db.scalars(
        select(Invitation)
        .where(Invitation.company_id == company_id)
        .order_by(Invitation.created_at.desc())
    ).all()


def create_invitation(
    db: Session,
    *,
    inviter: User,
    payload: InvitationAccountantCreate | InvitationClientCreate,
    role: UserRole,
    client_id: str | None = None,
) -> Invitation:
    if role == UserRole.ACCOUNTANT and client_id:
        raise ValueError("client_id doit être null pour une invitation ACCOUNTANT.")
    if role not in (UserRole.ACCOUNTANT, UserRole.CLIENT):
        raise ValueError("Rôle d'invitation invalide.")
    # Email already used by a user?
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user:
        raise ValueError("Un utilisateur existe déjà avec cet email.")

    # Existing pending invitation?
    existing_invite = db.scalar(
        select(Invitation)
        .where(Invitation.company_id == inviter.company_id)
        .where(Invitation.email == payload.email)
        .where(Invitation.status == InvitationStatus.PENDING)
    )
    if existing_invite and existing_invite.expires_at > _now():
        raise ValueError("Une invitation est déjà en attente pour cet email.")

    client_company_name = getattr(payload, "company_name", None)

    token = _generate_token(db)
    invitation = Invitation(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=role,
        token=token,
        status=InvitationStatus.PENDING,
        expires_at=_expires_at(),
        invited_by_user_id=inviter.id,
        company_id=inviter.company_id,
        client_id=client_id,
        client_company_name=client_company_name,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


def mark_expired(db: Session, invitation: Invitation) -> Invitation:
    invitation.status = InvitationStatus.EXPIRED
    db.commit()
    db.refresh(invitation)
    return invitation


def accept_invitation(db: Session, invitation: Invitation) -> Invitation:
    invitation.status = InvitationStatus.ACCEPTED
    invitation.accepted_at = _now()
    db.commit()
    db.refresh(invitation)
    return invitation
