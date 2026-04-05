"""Parsing des montants financiers (formats français, marocain, international)."""
import re
from typing import Optional


def parse_amount(amount_str: str) -> Optional[float]:
    """Parse un montant au format français/marocain vers float.

    Gère :
      - 1.234,56  (FR/MA)
      - 1,234.56  (US/UK)
      - 1234,56
      - 1234.56
      - espaces comme séparateurs de milliers
    """
    if not amount_str:
        return None

    cleaned = re.sub(r"[^\d,.]", "", amount_str.strip())
    if not cleaned:
        return None

    # Format FR/MA : 1.234,56 → point avant virgule
    if "," in cleaned and "." in cleaned:
        if cleaned.index(".") < cleaned.index(","):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")

    try:
        return round(float(cleaned), 2)
    except ValueError:
        return None
