from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

DocumentStatus = Literal["uploaded", "processing", "processed", "error"]


class DocumentCreate(BaseModel):
    client_id: str
    file_name: str
    file_url: str


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: str
    file_name: str
    file_url: str
    uploaded_at: datetime
    status: DocumentStatus
    invoice_id: Optional[str] = None  # présent si une Invoice est liée
