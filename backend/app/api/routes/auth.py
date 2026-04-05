from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.client import Client
from app.models.user import User, UserRole
from app.schemas.user import LoginRequest, MeUpdate, RegisterRequest, TokenResponse, UserRead
from app.services import user_service, company_service, email_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if user_service.get_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet email.",
        )
    company = company_service.create_company(db, payload.company_name)
    user = user_service.create_user(db, payload, company_id=company.id, role=UserRole.ADMIN)
    token = create_access_token(user.id)
    email_service.send_welcome_email(
        to_email=user.email,
        first_name=user.first_name,
        cabinet_name=company.name,
    )
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = user_service.authenticate(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect.",
        )
    # Block fully deactivated accounts
    if not user.is_active or getattr(user, 'access_level', 'full') == 'blocked':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte a été désactivé. Contactez votre cabinet comptable.",
        )
    # Readonly users CAN login — no block here
    if user.client_id:
        client = db.get(Client, user.client_id)
        if client and not client.is_active and getattr(client, 'access_level', 'full') == 'blocked':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Votre compte a été désactivé. Contactez votre cabinet comptable.",
            )
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


def _build_user_read(db: Session, user: User) -> UserRead:
    """Builds UserRead and populates client_company_name for CLIENT role."""
    user_read = UserRead.model_validate(user)
    if user.role == UserRole.CLIENT and user.client_id:
        client = db.get(Client, user.client_id)
        if client:
            user_read = UserRead(**{**user_read.model_dump(), 'client_company_name': client.name})
    return user_read


@router.get("/me", response_model=UserRead)
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _build_user_read(db, current_user)


@router.patch("/me", response_model=UserRead)
def update_me(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    update_data = payload.model_dump(exclude_none=True)
    company_name = update_data.pop("company_name", None)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    if company_name and current_user.client_id:
        client = db.get(Client, current_user.client_id)
        if client:
            client.name = company_name

    db.commit()
    db.refresh(current_user)
    return _build_user_read(db, current_user)
