from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.client import Client
from app.models.invitation import Invitation, InvitationStatus
from app.models.user import User, UserRole
from app.schemas.invitation import ClientMemberInviteCreate, InvitationRead
from app.services import email_service, invitation_service

router = APIRouter(prefix="/client/team", tags=["client-team"])

MAX_TEAM_MEMBERS = 10


def _require_client(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Accès réservé aux clients.")
    if not current_user.client_id:
        raise HTTPException(status_code=400, detail="Vous n'êtes pas associé à un dossier client.")
    return current_user


def _invitation_to_read(db: Session, invitation: Invitation) -> InvitationRead:
    client = db.get(Client, invitation.client_id) if invitation.client_id else None
    return InvitationRead.model_validate({
        "id": invitation.id,
        "token": invitation.token,
        "email": invitation.email,
        "first_name": invitation.first_name,
        "last_name": invitation.last_name,
        "role": invitation.role,
        "client_id": invitation.client_id,
        "client_name": client.name if client else None,
        "client_company_name": invitation.client_company_name,
        "status": invitation.status,
        "expires_at": invitation.expires_at,
        "invited_by_user_id": invitation.invited_by_user_id,
        "company_id": invitation.company_id,
        "accepted_at": invitation.accepted_at,
        "created_at": invitation.created_at,
    })


@router.get("", response_model=list[dict])
def list_team_members(
    current_user: User = Depends(_require_client),
    db: Session = Depends(get_db),
):
    members = db.scalars(
        select(User)
        .where(User.client_id == current_user.client_id)
        .where(User.role == UserRole.CLIENT)
        .order_by(User.created_at)
    ).all()
    return [
        {
            "id": m.id,
            "first_name": m.first_name,
            "last_name": m.last_name,
            "email": m.email,
            "is_active": m.is_active,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "is_me": m.id == current_user.id,
        }
        for m in members
    ]


@router.post("/invite", response_model=InvitationRead, status_code=201)
def invite_team_member(
    payload: ClientMemberInviteCreate,
    current_user: User = Depends(_require_client),
    db: Session = Depends(get_db),
):
    member_count = db.scalar(
        select(func.count(User.id))
        .where(User.client_id == current_user.client_id)
        .where(User.is_active == True)
    ) or 0

    if member_count >= MAX_TEAM_MEMBERS:
        raise HTTPException(
            status_code=400,
            detail=f"Limite de {MAX_TEAM_MEMBERS} membres atteinte.",
        )

    client = db.get(Client, current_user.client_id)

    try:
        invitation = invitation_service.create_invitation(
            db,
            inviter=current_user,
            payload=payload,
            role=UserRole.CLIENT,
            client_id=current_user.client_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    invite_link = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation.token}"
    email_service.send_invitation_client_email(
        to_email=invitation.email,
        first_name=invitation.first_name,
        cabinet_name=client.name if client else "",
        client_company_name=client.name if client else "",
        invite_link=invite_link,
    )

    return _invitation_to_read(db, invitation)


@router.get("/invitations", response_model=list[InvitationRead])
def list_team_invitations(
    current_user: User = Depends(_require_client),
    db: Session = Depends(get_db),
):
    invitations = db.scalars(
        select(Invitation)
        .where(Invitation.client_id == current_user.client_id)
        .order_by(Invitation.created_at.desc())
    ).all()
    return [_invitation_to_read(db, inv) for inv in invitations]


@router.post("/invitations/{invitation_id}/resend", status_code=204)
def resend_team_invitation(
    invitation_id: str,
    current_user: User = Depends(_require_client),
    db: Session = Depends(get_db),
):
    invitation = db.get(Invitation, invitation_id)
    if not invitation or invitation.client_id != current_user.client_id:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Seules les invitations en attente peuvent être renvoyées.")

    invitation = invitation_service.renew_invitation(db, invitation)

    client = db.get(Client, current_user.client_id)
    invite_link = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation.token}"
    email_service.send_invitation_client_email(
        to_email=invitation.email,
        first_name=invitation.first_name,
        cabinet_name=client.name if client else "",
        client_company_name=client.name if client else "",
        invite_link=invite_link,
    )


@router.delete("/invitations/{invitation_id}", status_code=204)
def cancel_team_invitation(
    invitation_id: str,
    current_user: User = Depends(_require_client),
    db: Session = Depends(get_db),
):
    invitation = db.get(Invitation, invitation_id)
    if not invitation or invitation.client_id != current_user.client_id:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Seules les invitations en attente peuvent être annulées.")
    invitation_service.cancel_invitation(db, invitation)


@router.delete("/{member_id}", status_code=204)
def remove_team_member(
    member_id: str,
    current_user: User = Depends(_require_client),
    db: Session = Depends(get_db),
):
    member = db.get(User, member_id)
    if not member or member.client_id != current_user.client_id:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    if member.id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous retirer vous-même.")
    member.is_active = False
    db.commit()
