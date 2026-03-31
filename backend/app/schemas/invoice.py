from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

InvoiceStatus = Literal["to_review", "validated", "rejected"]


class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    invoice_number: str
    supplier_name: str
    date: str
    total_amount: float
    vat_amount: float
    status: InvoiceStatus


class InvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    supplier_name: Optional[str] = None
    date: Optional[str] = None
    total_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    status: Optional[InvoiceStatus] = None
