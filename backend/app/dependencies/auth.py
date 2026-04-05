from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.dependencies import get_db
from app.models.client import Client
from app.models.user import User
from app.models.user import UserRole
from app.services import user_service

_bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    user_id = decode_access_token(token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré.",
        )

    user = user_service.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable.",
        )

    # Block fully deactivated users (blocked access_level or is_active=False)
    if getattr(user, 'access_level', 'full') == 'blocked' or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Accès révoqué.",
        )

    if user.client_id:
        client = db.get(Client, user.client_id)
        if client and (getattr(client, 'access_level', 'full') == 'blocked' or not client.is_active):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Accès révoqué.",
            )

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs.",
        )
    return current_user
