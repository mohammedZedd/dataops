from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

DocumentStatus = Literal["uploaded", "processing", "processed", "error"]


class DocumentCreate(BaseModel):
    client_id: str
    file_name: str
    s3_key: str


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    client_id: Optional[str] = None
    uploaded_by_user_id: Optional[str] = None
    file_name: str
    s3_key: str
    file_size: Optional[int] = None
    uploaded_at: datetime
    status: DocumentStatus
    invoice_id: Optional[str] = None


class PresignedUrlResponse(BaseModel):
    url: str
