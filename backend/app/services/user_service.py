from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.user import RegisterRequest


def get_by_email(db: Session, email: str) -> Optional[User]:
    return db.scalar(select(User).where(User.email == email))


def get_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.get(User, user_id)


def create_user(db: Session, payload: RegisterRequest, *, company_id: str, role: UserRole) -> User:
    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
        company_id=company_id,
        is_active=True,
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_user_from_invitation(
    db: Session,
    *,
    first_name: str,
    last_name: str,
    email: str,
    password: str,
    role: UserRole,
    company_id: str,
    client_id: str | None = None,
) -> User:
    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        company_id=company_id,
        client_id=client_id,
        is_active=True,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> Optional[User]:
    """Retourne l'utilisateur si les identifiants sont corrects, None sinon."""
    user = get_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user
