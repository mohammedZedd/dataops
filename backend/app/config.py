from pydantic_settings import BaseSettings


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
    S3_BUCKET_NAME: str = "dataops"

    class Config:
        env_file = ".env"


settings = Settings()
