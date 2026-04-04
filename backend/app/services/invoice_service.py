from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.document import Document
from app.schemas.invoice import InvoiceRead, InvoiceUpdate


def _to_read(inv: Invoice) -> InvoiceRead:
    return InvoiceRead(
        id=inv.id,
        document_id=inv.document_id,
        invoice_number=inv.invoice_number,
        supplier_name=inv.supplier_name,
        date=inv.date,
        total_amount=float(inv.total_amount),
        vat_amount=float(inv.vat_amount),
        status=inv.status,
        direction=inv.direction,
        tva_rate=float(inv.tva_rate) if inv.tva_rate is not None else 20.0,
        accounting_validated=bool(inv.accounting_validated),
        validated_accounts=inv.validated_accounts,
    )


def get_invoices_by_client(db: Session, client_id: str) -> list[InvoiceRead]:
    invoices = db.scalars(
        select(Invoice)
        .join(Document, Invoice.document_id == Document.id)
        .where(Document.client_id == client_id)
        .order_by(Invoice.id)
    ).all()
    return [_to_read(inv) for inv in invoices]


def get_invoice(db: Session, invoice_id: str) -> Optional[Invoice]:
    return db.get(Invoice, invoice_id)


def update_invoice(db: Session, invoice: Invoice, payload: InvoiceUpdate) -> Invoice:
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(invoice, field, value)
    db.commit()
    db.refresh(invoice)
    return invoice
