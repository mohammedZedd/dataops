from pathlib import Path
from pydantic_settings import BaseSettings

# Racine du projet : backend/app/config.py → backend/app → backend → racine
_PROJECT_ROOT = Path(__file__).parent.parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/payfit"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:5173"
    INVITE_EXPIRE_HOURS: int = 72

    # ─── JWT ──────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24h

    # ─── AWS ──────────────────────────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "eu-west-3"
    SES_SENDER_EMAIL: str = "noreply@dataops.ma"
    S3_BUCKET_NAME: str = "dataopsdepot"

    # ─── SMTP (Brevo / Gmail / Mailtrap / tout serveur SMTP) ─────────────────
    # Prioritaire sur AWS SES si SMTP_HOST est défini.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True

    model_config = {
        # Charge depuis la racine du projet en absolu — fonctionne partout :
        # local (uvicorn depuis backend/), Docker (WORKDIR /app), tests.
        # Les variables d'environnement système ont toujours priorité sur le fichier.
        "env_file": str(_ENV_FILE),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
