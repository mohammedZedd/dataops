from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.invitation import InvitationStatus
from app.models.user import UserRole


class InvitationAccountantCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr

    model_config = ConfigDict(str_strip_whitespace=True)


class InvitationClientCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    company_name: str
    client_id: Optional[str] = None

    model_config = ConfigDict(str_strip_whitespace=True)


class InvitationUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None
    client_id: Optional[str] = None
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(str_strip_whitespace=True)


class InvitationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    token: str
    email: str
    first_name: str
    last_name: str
    role: UserRole
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_company_name: Optional[str] = None
    status: InvitationStatus
    expires_at: datetime
    invited_by_user_id: str
    company_id: str
    accepted_at: Optional[datetime] = None
    created_at: datetime


class InvitationPublicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email: str
    first_name: str
    last_name: str
    role: UserRole
    company_name: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_company_name: Optional[str] = None
    status: InvitationStatus
    expires_at: datetime


class InvitationAcceptRequest(BaseModel):
    token: str
    first_name: str
    last_name: str
    phone_number: str
    password: str
    # Company info (optional — CLIENT role only)
    company_name: Optional[str] = None
    secteur_activite: Optional[str] = None
    forme_juridique: Optional[str] = None
    regime_fiscal: Optional[str] = None
    # Fiscal IDs (optional)
    ice: Optional[str] = None
    if_number: Optional[str] = None
    rc: Optional[str] = None
    tp: Optional[str] = None
    cnss: Optional[str] = None

    model_config = ConfigDict(str_strip_whitespace=True)
