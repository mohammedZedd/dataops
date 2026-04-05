from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.models.document import Document
from app.models.user import User, UserRole
from app.db.dependencies import get_db
from app.schemas.client import ClientCreate, ClientRead, ClientUserRead
from app.schemas.invoice import InvoiceRead
from app.services import client_service, invoice_service
from sqlalchemy import select, func

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[ClientRead])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.CLIENT:
        if not current_user.client_id:
            return []
        client = client_service.get_client(db, current_user.client_id)
        return [client_service._to_read(db, client)] if client else []
    return client_service.get_clients_by_company(db, current_user.company_id)


@router.post("", response_model=ClientRead, status_code=201)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    client = client_service.create_client(db, payload, company_id=current_user.company_id)
    return client_service._to_read(db, client)


@router.get("/users", response_model=list[ClientUserRead])
def list_client_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne tous les users avec role=CLIENT appartenant au cabinet."""
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    users = db.scalars(
        select(User)
        .where(User.company_id == current_user.company_id)
        .where(User.role == UserRole.CLIENT)
        .order_by(User.created_at.desc())
    ).all()
    result = []
    for u in users:
        company_name = None
        docs_count = 0
        secteur_activite = None
        regime_fiscal = None
        forme_juridique = None
        if u.client_id:
            client = client_service.get_client(db, u.client_id)
            if client:
                company_name = client.name
                secteur_activite = client.secteur_activite
                regime_fiscal = client.regime_fiscal
                forme_juridique = client.forme_juridique
            docs_count = db.scalar(
                select(func.count(Document.id)).where(Document.client_id == u.client_id)
            ) or 0
        result.append(ClientUserRead(
            id=u.id,
            first_name=u.first_name,
            last_name=u.last_name,
            email=u.email,
            phone_number=u.phone_number,
            client_id=u.client_id,
            client_company_name=company_name,
            secteur_activite=secteur_activite,
            regime_fiscal=regime_fiscal,
            forme_juridique=forme_juridique,
            documents_count=docs_count,
            is_active=u.is_active,
            created_at=u.created_at,
        ))
    return result


@router.get("/{client_id}", response_model=ClientRead)
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = client_service.get_client(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable.")
    if current_user.role == UserRole.CLIENT and current_user.client_id != client_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    if current_user.role != UserRole.CLIENT and client.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    return client_service._to_read(db, client)


@router.get("/{client_id}/invoices", response_model=list[InvoiceRead])
def list_client_invoices(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = client_service.get_client(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable.")
    if current_user.role == UserRole.CLIENT and current_user.client_id != client_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    if current_user.role != UserRole.CLIENT and client.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    return invoice_service.get_invoices_by_client(db, client_id)
