"""
Email service — AWS SES via boto3.

Chaque fonction publique retourne True (succès) ou False (échec).
Les erreurs sont loggées mais ne bloquent jamais le flow appelant.
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from string import Template
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings

logger = logging.getLogger("email")

# Dossier racine des templates, résolu à partir de ce fichier
_TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "emails"


# ─── Client boto3 (singleton) ─────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _ses_client():  # type: ignore[return]
    """Retourne le client SES. Initialisé une seule fois grâce à lru_cache."""
    return boto3.client(
        "ses",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


# ─── Helpers internes ─────────────────────────────────────────────────────────

def _render(template_name: str, variables: dict[str, str]) -> str:
    """Charge le template HTML et substitue les variables {{ key }}."""
    path = _TEMPLATES_DIR / template_name
    raw = path.read_text(encoding="utf-8")
    # On utilise str.replace séquentiellement pour éviter toute dépendance
    # à Jinja2 (les templates n'ont pas de logique, uniquement des variables).
    for key, value in variables.items():
        raw = raw.replace("{{ " + key + " }}", value)
    return raw


def _send(
    *,
    to_email: str,
    subject: str,
    html_body: str,
) -> bool:
    """Envoie un email via SES. Retourne True si succès, False sinon."""
    logger.info("[EMAIL] Sending to %s subject=%r", to_email, subject)
    try:
        _ses_client().send_email(
            Source=settings.SES_SENDER_EMAIL,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Html": {"Data": html_body, "Charset": "UTF-8"}},
            },
        )
        logger.info("[EMAIL] sent subject=%r to=%s", subject, to_email)
        return True
    except (BotoCoreError, ClientError) as exc:
        logger.error("[EMAIL] SES error subject=%r to=%s error=%s", subject, to_email, exc)
        return False
    except Exception as exc:  # noqa: BLE001
        logger.error("[EMAIL] unexpected error subject=%r to=%s error=%s", subject, to_email, exc)
        return False


# ─── API publique ──────────────────────────────────────────────────────────────

def send_invitation_accountant_email(
    *,
    to_email: str,
    first_name: str,
    cabinet_name: str,
    invite_link: str,
) -> bool:
    """
    Email envoyé au comptable invité par un admin.
    Template : invitation_accountant.html
    """
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
    """
    Email envoyé au client invité par un admin.
    Template : invitation_client.html
    """
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
    """
    Email de réinitialisation de mot de passe. Lien valable 1h.
    Template : reset_password.html
    """
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
    """
    Email de bienvenue envoyé à l'admin après création de son cabinet.
    Template : welcome.html
    """
    html = _render("welcome.html", {
        "first_name":   first_name,
        "cabinet_name": cabinet_name,
    })
    return _send(
        to_email=to_email,
        subject=f"Bienvenue sur ComptaFlow — {cabinet_name} est prêt",
        html_body=html,
    )
