from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.document import Document
from app.models.invoice import Invoice
from app.schemas.client import ClientCreate, ClientRead


def _to_read(db: Session, client: Client) -> ClientRead:
    """Enrichit un Client avec les compteurs calculés."""
    docs_count = db.scalar(
        select(func.count(Document.id)).where(Document.client_id == client.id)
    ) or 0

    to_review = db.scalar(
        select(func.count())
        .select_from(Invoice)
        .join(Document, Invoice.document_id == Document.id)
        .where(Document.client_id == client.id)
        .where(Invoice.status == "to_review")
    ) or 0

    return ClientRead(
        id=client.id,
        name=client.name,
        created_at=client.created_at,
        secteur_activite=client.secteur_activite,
        regime_fiscal=client.regime_fiscal,
        forme_juridique=client.forme_juridique,
        documents_count=docs_count,
        invoices_to_review=to_review,
    )


def get_clients(db: Session) -> list[ClientRead]:
    clients = db.scalars(select(Client).order_by(Client.created_at.desc())).all()
    return [_to_read(db, c) for c in clients]


def get_client(db: Session, client_id: str) -> Optional[Client]:
    return db.get(Client, client_id)


def create_client(db: Session, payload: ClientCreate, *, company_id: str) -> Client:
    client = Client(name=payload.name.strip(), company_id=company_id)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def get_clients_by_company(db: Session, company_id: str) -> list[ClientRead]:
    clients = db.scalars(
        select(Client)
        .where(Client.company_id == company_id)
        .order_by(Client.created_at.desc())
    ).all()
    return [_to_read(db, c) for c in clients]
