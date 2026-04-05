"""Parsing structuré de la réponse AWS Textract pour extraire les champs facture."""
import re
from typing import Optional

from app.utils.amount_parser import parse_amount
from app.utils.date_parser import parse_date
from app.utils.moroccan_fields import extract_ice, extract_if, extract_rc, extract_tp, extract_cnss, detect_currency
from app.utils.confidence_calculator import calculate_confidence


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

        result = {
            "invoice_number": self._extract_invoice_number(full_text, key_value_pairs),
            "date": parse_date(full_text, key_value_pairs),
            "supplier_name": self._extract_supplier_name(lines, key_value_pairs),
            "total_amount": self._extract_amount_ttc(full_text, key_value_pairs),
            "vat_amount": self._extract_vat_amount(full_text, key_value_pairs),
            "ht_amount": self._extract_amount_ht(full_text, key_value_pairs),
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
            r"(?:Facture\s*[Nn][°ºo]\.?\s*:?\s*)([A-Za-z0-9\-/_.]+)",
            r"(?:N[°ºo]\s*[Ff]acture\s*:?\s*)([A-Za-z0-9\-/_.]+)",
            r"(?:Invoice\s*(?:No|N°|#)\s*:?\s*)([A-Za-z0-9\-/_.]+)",
            r"(?:Réf(?:érence)?\s*:?\s*)([A-Za-z0-9\-/_.]+)",
            r"(FAC-\d{4}-\d+)",
            r"(F\d{4,})",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1) if match.lastindex else match.group(0)

        for key in ["n° facture", "numéro facture", "facture n°", "invoice no", "référence"]:
            if key in kvp:
                return kvp[key]
        return None

    def _extract_supplier_name(self, lines: list[str], kvp: dict) -> Optional[str]:
        patterns = [
            r"(?:De\s*:|Fournisseur\s*:|Émetteur\s*:|Société\s*:|Raison\s+sociale\s*:)\s*(.+)",
            r"(?:SARL|SA\s|SNC|EURL)\s+(.+)",
        ]
        for line in lines[:10]:
            for pattern in patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    return match.group(1).strip()

        for key in ["fournisseur", "émetteur", "société", "de"]:
            if key in kvp:
                return kvp[key]

        # Fallback: first non-trivial line
        for line in lines[:5]:
            if len(line) > 3 and not re.match(r"^\d", line):
                skip = any(kw in line.lower() for kw in [
                    "facture", "date", "n°", "page", "tel", "fax", "email", "@", "www",
                ])
                if not skip:
                    return line.strip()
        return None

    def _extract_amount_ttc(self, text: str, kvp: dict) -> Optional[float]:
        patterns = [
            r"(?:Total\s*TTC|Montant\s*TTC|Net\s*[àa]\s*payer|Total\s*[àa]\s*payer)\s*:?\s*([\d\s.,]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return parse_amount(match.group(1))

        for key in ["total ttc", "net à payer", "montant ttc", "total à payer"]:
            if key in kvp:
                return parse_amount(kvp[key])
        return None

    def _extract_vat_amount(self, text: str, kvp: dict) -> Optional[float]:
        match = re.search(
            r"(?:Montant\s*TVA|TVA|T\.V\.A\.?)\s*(?:\(\d+%?\))?\s*:?\s*([\d\s.,]+)",
            text, re.IGNORECASE,
        )
        if match:
            return parse_amount(match.group(1))

        for key in ["tva", "montant tva", "t.v.a"]:
            if key in kvp:
                return parse_amount(kvp[key])
        return None

    def _extract_amount_ht(self, text: str, kvp: dict) -> Optional[float]:
        match = re.search(
            r"(?:Total\s*HT|Montant\s*HT|Sous[\s-]*total|Base\s*HT)\s*:?\s*([\d\s.,]+)",
            text, re.IGNORECASE,
        )
        if match:
            return parse_amount(match.group(1))

        for key in ["total ht", "montant ht", "sous-total", "base ht"]:
            if key in kvp:
                return parse_amount(kvp[key])
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
