from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict

InvoiceStatus = Literal["to_review", "validated", "rejected"]
InvoiceDirection = Literal["achat", "vente"]


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
    direction: Optional[str] = None
    tva_rate: float = 20.0
    accounting_validated: bool = False
    validated_accounts: Optional[Any] = None


class InvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    supplier_name: Optional[str] = None
    date: Optional[str] = None
    total_amount: Optional[float] = None
    vat_amount: Optional[float] = None
    status: Optional[InvoiceStatus] = None
    direction: Optional[InvoiceDirection] = None


# ─── Accounting suggestion schemas ────────────────────────────────────────────

class AccountSuggestion(BaseModel):
    code: str
    libelle: str
    type: str          # charge | tva | tiers | produit
    sens: str          # debit | credit
    montant: float = 0.0
    is_primary: bool = True
    obligatoire: bool = True


class RetenueSource(BaseModel):
    applicable: bool = False
    taux: float = 0
    compte: Optional[str] = None
    libelle: Optional[str] = None
    note: Optional[str] = None


class SuggestedAccountsResponse(BaseModel):
    direction: str
    journal: str
    tva_rate: float
    tva_regime: str
    secteur: Optional[str] = None
    regime_fiscal: Optional[str] = None
    retenue_source: RetenueSource
    suggested_accounts: List[AccountSuggestion]


class SaveAccountsRequest(BaseModel):
    accounts: List[dict]
    direction: Optional[str] = None
