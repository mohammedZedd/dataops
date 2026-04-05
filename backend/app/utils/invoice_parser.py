"""Parsing structuré de la réponse AWS Textract pour extraire les champs facture."""
import re
from typing import Optional

from app.utils.amount_parser import parse_amount
from app.utils.date_parser import parse_date
from app.utils.moroccan_fields import extract_ice, extract_if, extract_rc, extract_tp, extract_cnss, detect_currency
from app.utils.confidence_calculator import calculate_confidence

_SKIP_LINE_PATTERNS = [
    r"^\[",
    r"\[.*\]",
    r"^Destinataire",
    r"^SIRET\s*:",
    r"^No\s+de\s+TVA",
    r"^Adresse",
    r"^Tél",
    r"^Date",
    r"^Échéance",
    r"^Facture",
    r"^Désignation",
    r"^Total",
    r"^TVA",
    r"^\d+,\d+",
]


class InvoiceParser:
    """Parse une réponse Textract (Blocks) en champs de facture structurés."""

    def parse(self, response: dict) -> dict:
        lines: list[str] = []
        key_value_pairs: dict[str, str] = {}
        all_blocks = response.get("Blocks", [])

        for block in all_blocks:
            if block["BlockType"] == "LINE":
                lines.append(block["Text"])
            elif block["BlockType"] == "KEY_VALUE_SET" and block.get("EntityTypes") == ["KEY"]:
                key_text = self._get_text_from_block(block, all_blocks)
                value_text = self._get_value_for_key(block, all_blocks)
                if key_text and value_text:
                    key_value_pairs[key_text.lower().strip().rstrip(":")] = value_text.strip()

        full_text = "\n".join(lines)
        return self._build_result(full_text, lines, key_value_pairs)

    def parse_text(self, text: str) -> dict:
        """Parse du texte brut directement (sans réponse Textract)."""
        lines = [l for l in text.split("\n") if l.strip()]
        return self._build_result(text, lines, {})

    def _build_result(self, full_text: str, lines: list[str], kvp: dict) -> dict:
        result = {
            "invoice_number": self._extract_invoice_number(full_text, kvp),
            "date": parse_date(full_text, kvp),
            "supplier_name": self._extract_supplier_name(lines, kvp),
            "total_amount": self._extract_amount_ttc(full_text, kvp),
            "vat_amount": self._extract_vat_amount(full_text, kvp),
            "ht_amount": self._extract_amount_ht(full_text, kvp),
            "vat_rate": self._extract_vat_rate(full_text),
            "ice": extract_ice(full_text),
            "if_fiscal": extract_if(full_text),
            "rc": extract_rc(full_text),
            "tp": extract_tp(full_text),
            "cnss": extract_cnss(full_text),
            "currency": detect_currency(full_text),
            "raw_text": full_text[:3000],
        }

        # Derive missing amounts
        ttc = result["total_amount"]
        ht = result["ht_amount"]
        tva = result["vat_amount"]
        rate = result["vat_rate"]

        if ttc and ht and not tva:
            result["vat_amount"] = round(ttc - ht, 2)
        elif ttc and tva and not ht:
            result["ht_amount"] = round(ttc - tva, 2)
        elif ht and tva and not ttc:
            result["total_amount"] = round(ht + tva, 2)
        elif ht and not tva and not ttc:
            result["vat_amount"] = round(ht * rate / 100, 2)
            result["total_amount"] = round(ht + result["vat_amount"], 2)

        result["confidence"] = calculate_confidence(result)
        return result

    # ─── Textract block helpers ──────────────────────────────────────────────

    def _get_text_from_block(self, block: dict, all_blocks: list[dict]) -> str:
        text = ""
        for rel in block.get("Relationships", []):
            if rel["Type"] == "CHILD":
                for block_id in rel["Ids"]:
                    for b in all_blocks:
                        if b["Id"] == block_id and b["BlockType"] == "WORD":
                            text += b["Text"] + " "
        return text.strip()

    def _get_value_for_key(self, key_block: dict, all_blocks: list[dict]) -> Optional[str]:
        for rel in key_block.get("Relationships", []):
            if rel["Type"] == "VALUE":
                for block_id in rel["Ids"]:
                    for b in all_blocks:
                        if b["Id"] == block_id:
                            return self._get_text_from_block(b, all_blocks)
        return None

    # ─── Field extraction ────────────────────────────────────────────────────

    def _extract_invoice_number(self, text: str, kvp: dict) -> Optional[str]:
        patterns = [
            # Handle № special character (French invoices)
            r"[Ff]acture\s*[№N][°o]?\.?\s*:?\s*(\d+)",
            r"[Ff]acture\s*#\s*(\d+)",
            r"№\s*(\d+)",
            r"N[°o]\.?\s*[Ff]acture\s*:?\s*(\d+)",
            # Standard formats with alphanumeric codes
            r"(?:Facture\s*[Nn][°ºo]\.?\s*:?\s*)([A-Za-z0-9\-/_.]+)",
            r"(?:N[°ºo]\s*[Ff]acture\s*:?\s*)([A-Za-z0-9\-/_.]+)",
            r"(?:Invoice\s*(?:No|N°|#)\s*:?\s*)([A-Za-z0-9\-/_.]+)",
            r"(FAC-\d{4}-\d+)",
            r"(F\d{4,})",
            # Moroccan reference formats
            r"(?:Facture\s*réf\.?\s*:?\s*)([A-Za-z0-9\-/_.]+)",
            r"(?:Référence\s*:?\s*)([A-Za-z0-9\-/_.]+)",
            r"(?:Réf\.?\s*:?\s*)([A-Za-z0-9\-/_.]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value = match.group(1) if match.lastindex else match.group(0)
                if "[" in value or "]" in value:
                    continue
                return value.strip()

        for key in ["n° facture", "numéro facture", "facture n°",
                     "invoice no", "réf", "référence", "facture №"]:
            if key in kvp:
                val = kvp[key]
                if val and "[" not in val:
                    return val
        return None

    def _extract_supplier_name(self, lines: list[str], kvp: dict) -> Optional[str]:
        supplier_patterns = [
            r"(?:De\s*:|Fournisseur\s*:|Émetteur\s*:|Société\s*:|Vendeur\s*:|Raison\s+sociale\s*:)\s*(.+)",
            r"(?:SARL|SA\s|SNC|EURL|Auto-entrepreneur)\s+([A-Za-zÀ-ÿ].+)",
        ]

        def _should_skip(line: str) -> bool:
            return any(re.search(p, line, re.IGNORECASE) for p in _SKIP_LINE_PATTERNS)

        # Explicit supplier keywords
        for line in lines:
            if _should_skip(line):
                continue
            for pattern in supplier_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    val = match.group(1).strip()
                    if val and "[" not in val and len(val) > 2:
                        return val

        # Key-value pairs
        for key in ["fournisseur", "émetteur", "société", "de", "vendeur"]:
            if key in kvp:
                val = kvp[key]
                if val and "[" not in val and len(val) > 2:
                    return val

        # Fallback: company name in footer (emitter usually at bottom)
        footer_lines = lines[-20:] if len(lines) > 20 else lines
        for line in footer_lines:
            line = line.strip()
            if len(line) < 3 or _should_skip(line):
                continue
            if re.match(r"^[\d\s.,€$]+$", line):
                continue
            if re.search(r"IBAN|SWIFT|BIC", line, re.IGNORECASE):
                continue
            if re.match(r"^[A-ZÀ-Ü][a-zA-ZÀ-ÿ\s.\-&]+$", line):
                return line

        return None

    def _extract_amount_ttc(self, text: str, kvp: dict) -> Optional[float]:
        patterns = [
            r"(?:Total\s*TTC|Montant\s*TTC|Net\s*[àa]\s*payer|Total\s*[àa]\s*payer|TOTAL\s*TTC)\s*:?\s*([\d\s.,]+)\s*(?:MAD|DH|Dhs|€|EUR)?",
            r"(?:Total\s*général|Montant\s*total)\s*:?\s*([\d\s.,]+)",
            r"Total\s+TTC\s*:\s*([\d.,\s]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                val = parse_amount(match.group(1))
                if val and val > 0:
                    return val

        for key in ["total ttc", "net à payer", "montant ttc", "total à payer"]:
            if key in kvp:
                val = parse_amount(kvp[key])
                if val and val > 0:
                    return val
        return None

    def _extract_vat_amount(self, text: str, kvp: dict) -> Optional[float]:
        patterns = [
            # TVA(20%): 80,00 € or TVA (20%) : 80,00
            r"TVA\s*\(\s*\d+\s*%\s*\)\s*:?\s*([\d\s.,]+)\s*(?:MAD|DH|Dhs|€|EUR)?",
            # TVA 20%: 2 000,00 MAD or TVA 20% : 80,00 €
            r"TVA\s+\d+\s*%\s*:?\s*([\d\s.,]+)\s*(?:MAD|DH|Dhs|€|EUR)?",
            # Montant TVA: 80,00
            r"(?:Montant\s*TVA)\s*:?\s*([\d\s.,]+)\s*(?:MAD|DH|€)?",
            # T.V.A : 80,00
            r"T\.V\.A\.?\s*:?\s*([\d\s.,]+)\s*(?:MAD|DH|€)?",
            # Taxe sur la Valeur Ajoutée
            r"(?:Taxe\s*sur\s*la\s*[Vv]aleur\s*[Aa]joutée)\s*:?\s*([\d\s.,]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                val = parse_amount(match.group(1))
                if val and val > 0:
                    return val

        for key in ["tva", "montant tva", "t.v.a"]:
            if key in kvp:
                val = parse_amount(kvp[key])
                if val and val > 0:
                    return val
        return None

    def _extract_amount_ht(self, text: str, kvp: dict) -> Optional[float]:
        patterns = [
            r"(?:Total\s*HT|Montant\s*HT|Sous[\s-]*total|Base\s*HT|TOTAL\s*HT)\s*:?\s*([\d\s.,]+)\s*(?:MAD|DH|€)?",
            # "Total: 400,00 €" (without HT label, before TVA line)
            r"^Total\s*:\s*([\d.,\s]+)\s*(?:€|MAD|DH)?",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                val = parse_amount(match.group(1))
                if val and val > 0:
                    return val

        for key in ["total ht", "montant ht", "sous-total", "base ht", "total"]:
            if key in kvp:
                val = parse_amount(kvp[key])
                if val and val > 0:
                    return val
        return None

    def _extract_vat_rate(self, text: str) -> float:
        patterns = [
            r"TVA\s*\(\s*(\d+)\s*%\s*\)",
            r"TVA\s+(\d+)\s*%",
            r"(\d+)\s*%\s*TVA",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                rate = float(match.group(1))
                if rate in (7, 10, 14, 20):
                    return rate
        return 20.0
