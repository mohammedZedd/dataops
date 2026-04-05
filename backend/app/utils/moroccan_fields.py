"""Extraction des identifiants légaux marocains (ICE, IF, RC, TP, CNSS)."""
import re
from typing import Optional


def extract_ice(text: str) -> Optional[str]:
    """ICE — Identifiant Commun de l'Entreprise (15 chiffres)."""
    match = re.search(r"(?:ICE|I\.C\.E\.?)\s*:?\s*(\d{15})", text, re.IGNORECASE)
    return match.group(1) if match else None


def extract_if(text: str) -> Optional[str]:
    """IF — Identifiant Fiscal."""
    match = re.search(
        r"(?:IF|I\.?F\.?|Identifiant\s*Fiscal)\s*:?\s*(\d+)",
        text, re.IGNORECASE,
    )
    return match.group(1) if match else None


def extract_rc(text: str) -> Optional[str]:
    """RC — Registre de Commerce."""
    match = re.search(
        r"(?:(?:^|\s)RC|R\.C\.?|Registre\s*(?:de\s*)?Commerce)\s*:\s*([A-Z0-9\-/]+)",
        text, re.IGNORECASE | re.MULTILINE,
    )
    return match.group(1) if match else None


def extract_tp(text: str) -> Optional[str]:
    """TP — Taxe Professionnelle (Patente)."""
    match = re.search(
        r"(?:TP|T\.?P\.?|Taxe\s*Professionnelle|Patente)\s*:?\s*(\d+)",
        text, re.IGNORECASE,
    )
    return match.group(1) if match else None


def extract_cnss(text: str) -> Optional[str]:
    """CNSS — Caisse Nationale de Sécurité Sociale."""
    match = re.search(r"(?:CNSS|C\.?N\.?S\.?S\.?)\s*:?\s*(\d+)", text, re.IGNORECASE)
    return match.group(1) if match else None


def detect_currency(text: str) -> str:
    """Détecte la devise mentionnée dans le texte."""
    if re.search(r"\bMAD\b|\bDH\b|\bDhs\b|\bDirhams?\b", text, re.IGNORECASE):
        return "MAD"
    if re.search(r"€|\bEUR\b|\bEuros?\b", text, re.IGNORECASE):
        return "EUR"
    return "MAD"
