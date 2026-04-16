"""Parsing et normalisation des dates (formats français/marocains)."""
import re
from typing import Optional

MONTHS_FR = {
    "janvier": "01", "février": "02", "mars": "03", "avril": "04",
    "mai": "05", "juin": "06", "juillet": "07", "août": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12",
}

_DATE_PATTERNS = [
    r"(?:Date\s*(?:de\s*)?(?:facturation|facture|d'émission)?\s*:?\s*)(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
    r"(\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4})",
    r"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})",
]


def _normalize_numeric_date(raw: str) -> Optional[str]:
    """dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy → YYYY-MM-DD."""
    for sep in ["/", "-", "."]:
        if sep in raw:
            parts = raw.split(sep)
            if len(parts) == 3:
                d, m, y = parts[0].strip(), parts[1].strip(), parts[2].strip()
                if len(y) == 2:
                    y = "20" + y
                return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    return None


def _normalize_french_date(raw: str) -> Optional[str]:
    """'4 avril 2026' → '2026-04-04'."""
    lower = raw.lower().strip()
    for month_name, month_num in MONTHS_FR.items():
        if month_name in lower:
            match = re.match(r"(\d{1,2})\s+" + month_name + r"\s+(\d{4})", lower)
            if match:
                return f"{match.group(2)}-{month_num}-{match.group(1).zfill(2)}"
    return None


def parse_date(text: str, kvp: dict | None = None) -> Optional[str]:
    """Recherche et normalise la première date trouvée dans le texte.

    Retourne au format ISO 8601 (YYYY-MM-DD) ou None.
    """
    for pattern in _DATE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            raw = match.group(1)
            result = _normalize_french_date(raw) or _normalize_numeric_date(raw)
            if result:
                return result
    return None
