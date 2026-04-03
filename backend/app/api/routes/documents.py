import io
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.models.document import Document
from app.models.user import User, UserRole
from app.db.dependencies import get_db
from app.schemas.document import DocumentCreate, DocumentRead, PresignedUrlResponse
from app.services import client_service, document_service, s3_service

router = APIRouter(tags=["documents"])

_ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}
_MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text


def _build_s3_key(user: User, filename: str) -> str:
    """Construit la clé S3 avec noms slugifiés selon le rôle de l'utilisateur."""
    safe_name = Path(filename).name  # évite les path traversal
    unique_name = f"{uuid.uuid4()}_{safe_name}"
    company_slug = _slugify(user.company.name)
    person_slug = _slugify(f"{user.first_name} {user.last_name}")
    if user.role == UserRole.CLIENT:
        return f"{company_slug}/clients/{person_slug}/{unique_name}"
    return f"{company_slug}/accountants/{person_slug}/{unique_name}"


def _check_ownership(doc: Document, current_user: User) -> None:
    if doc.uploaded_by_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé.")


# ─── Upload ───────────────────────────────────────────────────────────────────

@router.post("/documents/upload", response_model=DocumentRead, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Type non autorisé. PDF, JPG, PNG, XLSX acceptés.")

    content = await file.read()
    if len(content) > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10 Mo).")

    original_name = file.filename or "file"
    s3_key = _build_s3_key(current_user, original_name)

    s3_service.upload_file(
        file_obj=io.BytesIO(content),
        s3_key=s3_key,
        content_type=file.content_type or "application/octet-stream",
    )

    doc = Document(
        client_id=current_user.client_id,
        uploaded_by_user_id=current_user.id,
        file_name=original_name,
        s3_key=s3_key,
        file_size=len(content),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return document_service._to_read(doc)


# ─── Preview (presigned inline) ───────────────────────────────────────────────

@router.get("/documents/preview/{document_id}", response_model=PresignedUrlResponse)
def preview_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    _check_ownership(doc, current_user)

    url = s3_service.generate_presigned_url_inline(doc.s3_key, doc.file_name)
    return PresignedUrlResponse(url=url)


# ─── Download (presigned attachment) ──────────────────────────────────────────

@router.get("/documents/download/{document_id}", response_model=PresignedUrlResponse)
def download_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    _check_ownership(doc, current_user)

    url = s3_service.generate_presigned_url_attachment(doc.s3_key, doc.file_name)
    return PresignedUrlResponse(url=url)


# ─── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    _check_ownership(doc, current_user)

    s3_service.delete_file(doc.s3_key)
    db.delete(doc)
    db.commit()


# ─── List (user's own) ────────────────────────────────────────────────────────

@router.get("/documents/my", response_model=list[DocumentRead])
def list_my_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return document_service.get_documents_by_user(db, current_user.id)


# ─── Existing accounting routes (admin/accountant) ────────────────────────────

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
