from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.models.user import User, UserRole
from app.db.dependencies import get_db
from app.schemas.document import DocumentCreate, DocumentRead
from app.services import client_service, document_service

router = APIRouter(tags=["documents"])


@router.get("/clients/{client_id}/documents", response_model=list[DocumentRead])
def list_client_documents(
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
    return document_service.get_documents_by_client(db, client_id)


@router.post("/documents", response_model=DocumentRead, status_code=201)
def create_document(
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = client_service.get_client(db, payload.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable.")
    if current_user.role == UserRole.CLIENT and current_user.client_id != payload.client_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    if current_user.role != UserRole.CLIENT and client.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    return document_service.create_document(db, payload)


@router.get("/documents/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = document_service.get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    client = client_service.get_client(db, doc.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable.")
    if current_user.role == UserRole.CLIENT and current_user.client_id != doc.client_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    if current_user.role != UserRole.CLIENT and client.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    return document_service._to_read(doc)
