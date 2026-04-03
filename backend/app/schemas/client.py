from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ClientCreate(BaseModel):
    name: str


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: datetime
    invoices_to_review: int = 0   # calculé dans le service
    documents_count: int = 0       # calculé dans le service


class ClientUserRead(BaseModel):
    """User avec role=CLIENT vu par le cabinet."""
    id: str
    first_name: str
    last_name: str
    email: str
    phone_number: Optional[str]
    client_company_name: Optional[str]  # nom de la société du client (via clients.name)
    is_active: bool
    created_at: datetime
