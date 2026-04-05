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
    secteur_activite: Optional[str] = None
    regime_fiscal: Optional[str] = None
    forme_juridique: Optional[str] = None
    ice: Optional[str] = None
    if_number: Optional[str] = None
    rc: Optional[str] = None
    tp: Optional[str] = None
    cnss: Optional[str] = None
    invoices_to_review: int = 0
    documents_count: int = 0


class ClientUserRead(BaseModel):
    """User avec role=CLIENT vu par le cabinet."""
    id: str
    first_name: str
    last_name: str
    email: str
    phone_number: Optional[str]
    client_id: Optional[str] = None
    client_company_name: Optional[str]
    secteur_activite: Optional[str] = None
    regime_fiscal: Optional[str] = None
    forme_juridique: Optional[str] = None
    documents_count: int = 0
    is_active: bool
    access_level: str = "full"
    created_at: datetime
