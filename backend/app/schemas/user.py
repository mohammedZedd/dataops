from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, model_validator

from app.models.user import UserRole


# ─── Requêtes ─────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    company_name: str
    password: str

    model_config = ConfigDict(str_strip_whitespace=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ─── Réponses ─────────────────────────────────────────────────────────────────

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    first_name: str
    last_name: str
    email: str
    role: UserRole
    company_id: str
    company_name: Optional[str] = None
    client_id: Optional[str] = None
    created_at: datetime

    @model_validator(mode='before')
    @classmethod
    def populate_company_name(cls, data):
        # When built from an ORM User with the `company` relationship loaded,
        # extract company.name so the frontend never needs a separate API call.
        if hasattr(data, 'company') and data.company is not None:
            return {
                'id': data.id,
                'first_name': data.first_name,
                'last_name': data.last_name,
                'email': data.email,
                'role': data.role,
                'company_id': data.company_id,
                'company_name': data.company.name,
                'client_id': data.client_id,
                'created_at': data.created_at,
            }
        return data


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
