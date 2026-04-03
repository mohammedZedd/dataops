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


@lru_cache(maxsize=1)
def _s3_client():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


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
    url: str = _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": s3_key},
        ExpiresIn=expiration,
    )
    return url


def generate_presigned_url_inline(s3_key: str, filename: str, expiration: int = 3600) -> str:
    """Presigned URL avec Content-Disposition: inline (pour preview)."""
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
    try:
        _s3_client().delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        logger.info("[S3] deleted key=%s", s3_key)
        return True
    except (BotoCoreError, ClientError) as exc:
        logger.error("[S3] delete error key=%s error=%s", s3_key, exc)
        return False
