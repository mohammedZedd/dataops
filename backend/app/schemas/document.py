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
    doc_type: Optional[str] = None
    description: Optional[str] = None
    is_new: bool = True
    client_name: Optional[str] = None
    invoice_id: Optional[str] = None
    invoice_status: Optional[str] = None


class ManualInvoiceCreate(BaseModel):
    invoice_number: Optional[str] = None
    supplier_name: Optional[str] = None
    date: Optional[str] = None
    total_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    direction: Optional[str] = None


class ExtractionResult(BaseModel):
    invoice_number: Optional[str] = None
    date: Optional[str] = None
    supplier_name: Optional[str] = None
    total_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    ht_amount: Optional[float] = None
    vat_rate: float = 20
    ice: Optional[str] = None
    if_fiscal: Optional[str] = None
    rc: Optional[str] = None
    tp: Optional[str] = None
    cnss: Optional[str] = None
    currency: str = "MAD"
    confidence: float = 0.0
    raw_text: str = ""


class PresignedUrlResponse(BaseModel):
    url: str
