"""
Email service — SMTP (Brevo, Gmail, Mailtrap…) ou AWS SES comme fallback.

Priorité :
  1. SMTP si SMTP_HOST est configuré dans les variables d'environnement
  2. AWS SES si AWS_ACCESS_KEY_ID est configuré
  3. Sinon : log d'avertissement, aucun email envoyé

Chaque fonction publique retourne True (succès) ou False (échec).
Les erreurs sont loggées mais ne bloquent jamais le flow appelant.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import lru_cache
from pathlib import Path

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings

logger = logging.getLogger("email")

_TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "emails"


# ─── Template rendering ───────────────────────────────────────────────────────

def _render(template_name: str, variables: dict[str, str]) -> str:
    path = _TEMPLATES_DIR / template_name
    raw = path.read_text(encoding="utf-8")
    for key, value in variables.items():
        raw = raw.replace("{{ " + key + " }}", value)
    return raw


# ─── SMTP sender ──────────────────────────────────────────────────────────────

def _send_smtp(*, to_email: str, subject: str, html_body: str) -> bool:
    """Envoie via SMTP (Brevo, Gmail, Mailtrap, etc.)."""
    from_addr = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    logger.info("[EMAIL/SMTP] Sending to %s subject=%r", to_email, subject)
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = from_addr
        msg["To"]      = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        if settings.SMTP_USE_TLS:
            # STARTTLS — port 587 standard
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(from_addr, [to_email], msg.as_string())
        else:
            # SSL direct — port 465
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=ctx, timeout=10) as server:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.sendmail(from_addr, [to_email], msg.as_string())

        logger.info("[EMAIL/SMTP] Sent subject=%r to=%s", subject, to_email)
        return True
    except Exception as exc:
        logger.error("[EMAIL/SMTP] Error subject=%r to=%s error=%s", subject, to_email, exc)
        return False


# ─── AWS SES sender ───────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _ses_client():  # type: ignore[return]
    return boto3.client(
        "ses",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _send_ses(*, to_email: str, subject: str, html_body: str) -> bool:
    logger.info("[EMAIL/SES] Sending to %s subject=%r", to_email, subject)
    try:
        _ses_client().send_email(
            Source=settings.SES_SENDER_EMAIL,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Html": {"Data": html_body, "Charset": "UTF-8"}},
            },
        )
        logger.info("[EMAIL/SES] Sent subject=%r to=%s", subject, to_email)
        return True
    except (BotoCoreError, ClientError) as exc:
        logger.error("[EMAIL/SES] Error subject=%r to=%s error=%s", subject, to_email, exc)
        return False
    except Exception as exc:
        logger.error("[EMAIL/SES] Unexpected error subject=%r to=%s error=%s", subject, to_email, exc)
        return False


# ─── Dispatcher ───────────────────────────────────────────────────────────────

def _send(*, to_email: str, subject: str, html_body: str) -> bool:
    """Choisit automatiquement SMTP ou SES selon la configuration."""
    if settings.SMTP_HOST:
        return _send_smtp(to_email=to_email, subject=subject, html_body=html_body)
    if settings.AWS_ACCESS_KEY_ID:
        return _send_ses(to_email=to_email, subject=subject, html_body=html_body)
    logger.warning(
        "[EMAIL] Aucun service email configuré. "
        "Définissez SMTP_HOST ou AWS_ACCESS_KEY_ID dans votre .env. "
        "Email non envoyé à %s", to_email
    )
    return False


# ─── API publique ──────────────────────────────────────────────────────────────

def send_invitation_accountant_email(
    *,
    to_email: str,
    first_name: str,
    cabinet_name: str,
    invite_link: str,
) -> bool:
    html = _render("invitation_accountant.html", {
        "first_name":   first_name,
        "cabinet_name": cabinet_name,
        "invite_link":  invite_link,
    })
    return _send(
        to_email=to_email,
        subject=f"Invitation à rejoindre {cabinet_name} sur ComptaFlow",
        html_body=html,
    )


def send_invitation_client_email(
    *,
    to_email: str,
    first_name: str,
    cabinet_name: str,
    client_company_name: str,
    invite_link: str,
) -> bool:
    html = _render("invitation_client.html", {
        "first_name":           first_name,
        "cabinet_name":         cabinet_name,
        "client_company_name":  client_company_name,
        "invite_link":          invite_link,
    })
    return _send(
        to_email=to_email,
        subject=f"{cabinet_name} vous invite à accéder à votre espace ComptaFlow",
        html_body=html,
    )


def send_reset_password_email(
    *,
    to_email: str,
    first_name: str,
    reset_link: str,
) -> bool:
    html = _render("reset_password.html", {
        "first_name": first_name,
        "reset_link": reset_link,
    })
    return _send(
        to_email=to_email,
        subject="Réinitialisez votre mot de passe ComptaFlow",
        html_body=html,
    )


def send_welcome_email(
    *,
    to_email: str,
    first_name: str,
    cabinet_name: str,
) -> bool:
    html = _render("welcome.html", {
        "first_name":   first_name,
        "cabinet_name": cabinet_name,
    })
    return _send(
        to_email=to_email,
        subject=f"Bienvenue sur ComptaFlow — {cabinet_name} est prêt",
        html_body=html,
    )
