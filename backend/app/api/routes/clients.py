from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.models.user import User, UserRole
from app.db.dependencies import get_db
from app.schemas.client import ClientCreate, ClientRead
from app.schemas.invoice import InvoiceRead
from app.services import client_service, invoice_service

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
