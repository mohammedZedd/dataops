"""Service AWS Textract — extraction de texte structuré depuis des documents S3."""
import logging
import time

import boto3
from botocore.exceptions import ClientError

from app.config import settings
from app.services.s3_service import clean_s3_key
from app.utils.invoice_parser import InvoiceParser

logger = logging.getLogger("textract")

_RETRYABLE_ERRORS = {"ThrottlingException", "ProvisionedThroughputExceededException"}
_MAX_RETRIES = 3
_RETRY_DELAY = 2  # seconds


class TextractService:
    def __init__(self) -> None:
        self.textract = boto3.client(
            "textract",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        self.s3_bucket = settings.S3_BUCKET_NAME
        self.parser = InvoiceParser()

    def extract_from_s3(self, s3_key: str) -> dict:
        """Analyse un document S3 avec Textract et retourne les champs extraits.

        Tente AnalyzeDocument (FORMS+TABLES) puis fallback sur DetectDocumentText.
        """
        s3_key = clean_s3_key(s3_key)
        logger.info("[Textract] Extracting from s3://%s/%s", self.s3_bucket, s3_key)
        s3_ref = {"S3Object": {"Bucket": self.s3_bucket, "Name": s3_key}}

        response = self._call_with_retry(
            lambda: self.textract.analyze_document(
                Document=s3_ref,
                FeatureTypes=["FORMS", "TABLES"],
            ),
            fallback=lambda: self.textract.detect_document_text(Document=s3_ref),
        )

        return self.parser.parse(response)

    def _call_with_retry(self, primary, fallback=None) -> dict:
        """Exécute primary avec retry sur throttling, puis fallback si erreur."""
        last_error = None

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                return primary()
            except ClientError as exc:
                error_code = exc.response["Error"]["Code"]
                last_error = exc

                if error_code in _RETRYABLE_ERRORS:
                    logger.warning(
                        "[Textract] Throttled (attempt %d/%d), retrying in %ds…",
                        attempt, _MAX_RETRIES, _RETRY_DELAY,
                    )
                    time.sleep(_RETRY_DELAY)
                    continue

                if error_code == "InvalidS3ObjectException":
                    raise TextractError("Le document n'est pas accessible dans S3.") from exc
                if error_code == "UnsupportedDocumentException":
                    raise TextractError("Format non supporté. Utilisez PDF, JPEG ou PNG.") from exc
                if error_code == "DocumentTooLargeException":
                    raise TextractError("Document trop volumineux (max 10 Mo).") from exc

                # For other AnalyzeDocument errors, try fallback
                if fallback:
                    logger.info("[Textract] AnalyzeDocument failed (%s), falling back to DetectDocumentText", error_code)
                    try:
                        return fallback()
                    except ClientError as fb_exc:
                        raise TextractError(f"Extraction impossible: {fb_exc}") from fb_exc

                raise TextractError(f"Extraction impossible: {exc}") from exc
            except Exception as exc:
                raise TextractError(f"Extraction impossible: {exc}") from exc

        raise TextractError(f"Extraction impossible après {_MAX_RETRIES} tentatives: {last_error}")


class TextractError(Exception):
    """Raised when Textract extraction fails."""
    pass


textract_service = TextractService()
