from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.models.user import User, UserRole
from app.db.dependencies import get_db
from app.schemas.invoice import InvoiceRead, InvoiceUpdate
from app.services import invoice_service, document_service, client_service

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.patch("/{invoice_id}", response_model=InvoiceRead)
def update_invoice(
    invoice_id: str,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    invoice = invoice_service.get_invoice(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Facture introuvable.")
    doc = document_service.get_document(db, invoice.document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    client = client_service.get_client(db, doc.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable.")
    if client.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    updated = invoice_service.update_invoice(db, invoice, payload)
    return invoice_service._to_read(updated)
