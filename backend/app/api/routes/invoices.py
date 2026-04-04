from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_user
from app.models.user import User, UserRole
from app.db.dependencies import get_db
from app.schemas.invoice import (
    InvoiceRead,
    InvoiceUpdate,
    SaveAccountsRequest,
    SuggestedAccountsResponse,
    AccountSuggestion,
)
from app.services import invoice_service, document_service, client_service
from app.services import accounting_suggestion_service

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _get_invoice_with_access(invoice_id: str, db: Session, current_user: User):
    """Shared access check: loads invoice + verifies company ownership."""
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
    return invoice, client


@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice, _ = _get_invoice_with_access(invoice_id, db, current_user)
    return invoice_service._to_read(invoice)


@router.patch("/{invoice_id}", response_model=InvoiceRead)
def update_invoice(
    invoice_id: str,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")
    invoice, _ = _get_invoice_with_access(invoice_id, db, current_user)
    updated = invoice_service.update_invoice(db, invoice, payload)
    return invoice_service._to_read(updated)


@router.get("/{invoice_id}/suggested-accounts", response_model=SuggestedAccountsResponse)
def get_suggested_accounts(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")

    invoice, client = _get_invoice_with_access(invoice_id, db, current_user)

    # Auto-detect direction if not set
    direction = invoice.direction
    if not direction:
        client_name = (client.name or "").strip().lower()
        supplier = (invoice.supplier_name or "").strip().lower()
        direction = "vente" if supplier == client_name else "achat"

    tva_rate = accounting_suggestion_service.get_tva_rate(client.secteur_activite)
    total_amount = float(invoice.total_amount)
    vat_amount = float(invoice.vat_amount)

    raw_accounts = accounting_suggestion_service.get_suggested_accounts(
        secteur_activite=client.secteur_activite,
        direction=direction,
        total_amount=total_amount,
        vat_amount=vat_amount,
    )

    suggestions = [AccountSuggestion(**acc) for acc in raw_accounts]

    return SuggestedAccountsResponse(
        direction=direction,
        tva_rate=tva_rate,
        suggested_accounts=suggestions,
    )


@router.post("/{invoice_id}/accounts", response_model=InvoiceRead)
def save_invoice_accounts(
    invoice_id: str,
    payload: SaveAccountsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès refusé.")

    invoice, _ = _get_invoice_with_access(invoice_id, db, current_user)

    invoice.validated_accounts = payload.accounts
    invoice.accounting_validated = True
    if payload.direction:
        invoice.direction = payload.direction

    db.commit()
    db.refresh(invoice)
    return invoice_service._to_read(invoice)
