from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.client import Client
from app.models.user import User, UserRole
from app.schemas.client import ClientUserRead
from app.schemas.user import UserUpdate
from app.services import user_service, client_service

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/{user_id}", response_model=ClientUserRead)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.ACCOUNTANT):
        raise HTTPException(status_code=403, detail="Accès refusé.")

    target = user_service.get_by_id(db, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    if target.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")

    update_data = payload.model_dump(exclude_none=True)
    company_name = update_data.pop("company_name", None)
    secteur_activite = update_data.pop("secteur_activite", None)
    regime_fiscal = update_data.pop("regime_fiscal", None)
    forme_juridique = update_data.pop("forme_juridique", None)

    for field, value in update_data.items():
        setattr(target, field, value)

    client = None
    if target.client_id:
        client = db.get(Client, target.client_id)
        if client:
            if company_name:
                client.name = company_name
            if secteur_activite is not None:
                client.secteur_activite = secteur_activite
            if regime_fiscal is not None:
                client.regime_fiscal = regime_fiscal
            if forme_juridique is not None:
                client.forme_juridique = forme_juridique
            if "is_active" in payload.model_dump(exclude_none=True):
                client.is_active = target.is_active

    db.commit()
    db.refresh(target)

    return ClientUserRead(
        id=target.id,
        first_name=target.first_name,
        last_name=target.last_name,
        email=target.email,
        phone_number=target.phone_number,
        client_id=target.client_id,
        client_company_name=client.name if client else None,
        secteur_activite=client.secteur_activite if client else None,
        regime_fiscal=client.regime_fiscal if client else None,
        forme_juridique=client.forme_juridique if client else None,
        is_active=target.is_active,
        created_at=target.created_at,
    )
