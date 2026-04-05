from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db.dependencies import get_db
from app.dependencies.auth import require_admin
from app.models.company import Company
from app.models.invitation import Invitation as InvitationModel, InvitationStatus
from app.models.user import User, UserRole
from app.models.client import Client
from app.schemas.invitation import (
    InvitationAcceptRequest,
    InvitationAccountantCreate,
    InvitationClientCreate,
    InvitationPublicRead,
    InvitationRead,
)
from app.schemas.user import TokenResponse, UserRead
from app.services import email_service, invitation_service, user_service
from app.core.security import create_access_token

router = APIRouter(prefix="/invitations", tags=["invitations"])


def _invitation_to_read(db: Session, invitation):
    client_name = None
    if invitation.client_id:
        client = db.get(Client, invitation.client_id)
        if client:
            client_name = client.name
    data = {
        "id": invitation.id,
        "email": invitation.email,
        "first_name": invitation.first_name,
        "last_name": invitation.last_name,
        "role": invitation.role,
        "client_id": invitation.client_id,
        "client_name": client_name,
        "client_company_name": invitation.client_company_name,
        "status": invitation.status,
        "expires_at": invitation.expires_at,
        "invited_by_user_id": invitation.invited_by_user_id,
        "company_id": invitation.company_id,
        "accepted_at": invitation.accepted_at,
        "created_at": invitation.created_at,
    }
    return InvitationRead.model_validate(data)


def _invitation_to_public(db: Session, invitation):
    client_name = None
    if invitation.client_id:
        client = db.get(Client, invitation.client_id)
        if client:
            client_name = client.name
    company = db.get(Company, invitation.company_id)
    data = {
        "email": invitation.email,
        "first_name": invitation.first_name,
        "last_name": invitation.last_name,
        "role": invitation.role,
        "company_name": company.name if company else None,
        "client_id": invitation.client_id,
        "client_name": client_name,
        "client_company_name": invitation.client_company_name,
        "status": invitation.status,
        "expires_at": invitation.expires_at,
    }
    return InvitationPublicRead.model_validate(data)


@router.post("/accountants", response_model=InvitationRead, status_code=201)
def invite_accountant(
    payload: InvitationAccountantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="Cabinet manquant pour l'admin.")

    try:
        invitation = invitation_service.create_invitation(
            db, inviter=current_user, payload=payload, role=UserRole.ACCOUNTANT, client_id=None
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    invite_link = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation.token}"
    email_service.send_invitation_accountant_email(
        to_email=invitation.email,
        first_name=invitation.first_name,
        cabinet_name=current_user.company.name,
        invite_link=invite_link,
    )

    return _invitation_to_read(db, invitation)


@router.post("/clients", response_model=InvitationRead, status_code=201)
def invite_client(
    payload: InvitationClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="Cabinet manquant pour l'admin.")

    client_id = payload.client_id
    if client_id:
        client = db.get(Client, client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client introuvable.")
        if client.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Client hors du cabinet.")
    elif payload.company_name:
        # Auto-create Client record from company_name
        new_client = Client(name=payload.company_name.strip(), company_id=current_user.company_id)
        db.add(new_client)
        db.flush()
        client_id = new_client.id

    # Reactivation path: email already exists but user is inactive
    existing_user = user_service.get_by_email(db, payload.email)
    if existing_user:
        if existing_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un utilisateur actif existe déjà avec cet email.",
            )
        existing_user.is_active = True
        # Link to client if user has no client_id
        if not existing_user.client_id and client_id:
            existing_user.client_id = client_id
        if existing_user.client_id:
            existing_client = db.get(Client, existing_user.client_id)
            if existing_client:
                existing_client.is_active = True
        db.commit()
        return JSONResponse({"reactivated": True, "message": "Accès réactivé avec succès"})

    try:
        invitation = invitation_service.create_invitation(
            db, inviter=current_user, payload=payload, role=UserRole.CLIENT, client_id=client_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    invite_link = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation.token}"
    email_service.send_invitation_client_email(
        to_email=invitation.email,
        first_name=invitation.first_name,
        cabinet_name=current_user.company.name,
        client_company_name=payload.company_name or "",
        invite_link=invite_link,
    )

    return _invitation_to_read(db, invitation)


@router.get("", response_model=list[InvitationRead])
def list_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return [_invitation_to_read(db, i) for i in invitation_service.list_by_company(db, current_user.company_id)]


@router.get("/{token}", response_model=InvitationPublicRead)
def get_invitation(token: str, db: Session = Depends(get_db)):
    invitation = invitation_service.get_by_token(db, token)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation invalide.")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Invitation déjà utilisée.")

    if invitation.expires_at <= invitation_service._now():
        invitation_service.mark_expired(db, invitation)
        raise HTTPException(status_code=410, detail="Invitation expirée.")

    return _invitation_to_public(db, invitation)


@router.delete("/{invitation_id}", status_code=204)
def revoke_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    invitation = db.get(InvitationModel, invitation_id)
    if not invitation or invitation.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Seules les invitations en attente peuvent être révoquées.")
    invitation_service.cancel_invitation(db, invitation)


@router.post("/resend/{invitation_id}", status_code=204)
def resend_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    invitation = db.get(InvitationModel, invitation_id)
    if not invitation or invitation.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    invitation = invitation_service.renew_invitation(db, invitation)

    invite_link = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation.token}"
    if invitation.role == UserRole.ACCOUNTANT:
        email_service.send_invitation_accountant_email(
            to_email=invitation.email,
            first_name=invitation.first_name,
            cabinet_name=current_user.company.name,
            invite_link=invite_link,
        )
    else:
        email_service.send_invitation_client_email(
            to_email=invitation.email,
            first_name=invitation.first_name,
            cabinet_name=current_user.company.name,
            client_company_name=invitation.client_company_name or "",
            invite_link=invite_link,
        )


@router.post("/accept", response_model=TokenResponse)
def accept_invitation(payload: InvitationAcceptRequest, db: Session = Depends(get_db)):
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit faire au moins 8 caractères.")

    invitation = invitation_service.get_by_token(db, payload.token)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation invalide.")

    if invitation.status == InvitationStatus.ACCEPTED:
        raise HTTPException(status_code=409, detail="Invitation déjà utilisée.")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail="Invitation annulée ou invalide.")

    if invitation.expires_at <= invitation_service._now():
        invitation_service.mark_expired(db, invitation)
        raise HTTPException(status_code=410, detail="Invitation expirée.")

    if user_service.get_by_email(db, invitation.email):
        raise HTTPException(status_code=409, detail="Un utilisateur existe déjà avec cet email.")

    user = user_service.create_user_from_invitation(
        db,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=invitation.email,
        password=payload.password,
        role=invitation.role,
        company_id=invitation.company_id,
        client_id=invitation.client_id,
        phone_number=payload.phone_number,
    )

    # Update linked Client with company/fiscal info from the registration form
    if user.client_id:
        client_record = db.get(Client, user.client_id)
        if client_record:
            if payload.company_name:
                client_record.name = payload.company_name.strip()
            if payload.secteur_activite:
                client_record.secteur_activite = payload.secteur_activite
            if payload.forme_juridique:
                client_record.forme_juridique = payload.forme_juridique
            if payload.regime_fiscal:
                client_record.regime_fiscal = payload.regime_fiscal
            if payload.ice:
                client_record.ice = payload.ice
            if payload.if_number:
                client_record.if_number = payload.if_number
            if payload.rc:
                client_record.rc = payload.rc
            if payload.tp:
                client_record.tp = payload.tp
            if payload.cnss:
                client_record.cnss = payload.cnss
            db.flush()

    invitation_service.accept_invitation(db, invitation)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))
