from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentRead


def _to_read(doc: Document) -> DocumentRead:
    return DocumentRead(
        id=doc.id,
        client_id=doc.client_id,
        file_name=doc.file_name,
        file_url=doc.file_url,
        uploaded_at=doc.uploaded_at,
        status=doc.status,
        invoice_id=doc.invoice.id if doc.invoice else None,
    )


def get_documents_by_client(db: Session, client_id: str) -> list[DocumentRead]:
    docs = db.scalars(
        select(Document)
        .where(Document.client_id == client_id)
        .order_by(Document.uploaded_at.desc())
    ).all()
    return [_to_read(d) for d in docs]


def get_document(db: Session, document_id: str) -> Optional[Document]:
    return db.get(Document, document_id)


def create_document(db: Session, payload: DocumentCreate) -> Document:
    doc = Document(
        client_id=payload.client_id,
        file_name=payload.file_name,
        file_url=payload.file_url,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
