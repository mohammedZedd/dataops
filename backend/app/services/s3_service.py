"""
Service S3 — upload, presigned URLs, suppression.
Le client boto3 est un singleton (lru_cache).
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import BinaryIO

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings

logger = logging.getLogger("s3")

_VALID_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".xls", ".webm", ".mp4", ".mp3", ".ogg", ".wav")


def clean_s3_key(s3_key: str) -> str:
    """Strip query params or garbage appended after the file extension."""
    if "?" in s3_key:
        s3_key = s3_key.split("?")[0]
    lower = s3_key.lower()
    for ext in _VALID_EXTENSIONS:
        idx = lower.rfind(ext)
        if idx != -1:
            return s3_key[: idx + len(ext)]
    return s3_key


@lru_cache(maxsize=1)
def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def download_file(s3_key: str) -> bytes:
    """Télécharge un fichier depuis S3. Retourne le contenu en bytes."""
    import io
    s3_key = clean_s3_key(s3_key)
    buf = io.BytesIO()
    _s3_client().download_fileobj(settings.S3_BUCKET_NAME, s3_key, buf)
    buf.seek(0)
    return buf.read()


def upload_file(file_obj: BinaryIO, s3_key: str, content_type: str) -> str:
    """Upload un fichier vers S3. Retourne la clé S3."""
    _s3_client().upload_fileobj(
        file_obj,
        settings.S3_BUCKET_NAME,
        s3_key,
        ExtraArgs={"ContentType": content_type},
    )
    logger.info("[S3] uploaded key=%s", s3_key)
    return s3_key


def generate_presigned_url(s3_key: str, expiration: int = 3600) -> str:
    """Génère une presigned URL GET valable `expiration` secondes."""
    s3_key = clean_s3_key(s3_key)
    url: str = _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": s3_key},
        ExpiresIn=expiration,
    )
    return url


def generate_presigned_url_inline(s3_key: str, filename: str, expiration: int = 3600) -> str:
    """Presigned URL avec Content-Disposition: inline (pour preview)."""
    s3_key = clean_s3_key(s3_key)
    url: str = _s3_client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": s3_key,
            "ResponseContentDisposition": f'inline; filename="{filename}"',
        },
        ExpiresIn=expiration,
    )
    return url


def generate_presigned_url_attachment(s3_key: str, filename: str, expiration: int = 3600) -> str:
    """Presigned URL avec Content-Disposition: attachment (pour download)."""
    s3_key = clean_s3_key(s3_key)
    url: str = _s3_client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": s3_key,
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
        },
        ExpiresIn=expiration,
    )
    return url


def delete_file(s3_key: str) -> bool:
    """Supprime un objet S3. Retourne True si succès."""
    s3_key = clean_s3_key(s3_key)
    try:
        _s3_client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        logger.info("[S3] deleted key=%s", s3_key)
        return True
    except (BotoCoreError, ClientError) as exc:
        logger.error("[S3] delete error key=%s error=%s", s3_key, exc)
        return False
