"""Tests pour le parser de factures."""
from app.utils.invoice_parser import InvoiceParser


def test_french_invoice_with_numero_sign():
    text = """
Facture № 552
Date de facturation: 12/07/2021
Total: 400,00 €
TVA(20%): 80,00 €
Total TTC: 480,00 €
"""
    parser = InvoiceParser()
    result = parser.parse_text(text)

    assert result["invoice_number"] == "552"
    assert result["date"] == "2021-07-12"
    assert result["total_amount"] == 480.00
    assert result["vat_amount"] == 80.00
    assert result["vat_rate"] == 20.0
    assert result["ht_amount"] == 400.00
    assert result["currency"] == "EUR"
    assert result["confidence"] >= 0.55


def test_moroccan_invoice():
    text = """
SARL Atlas Commerce
ICE: 001234567890123
IF: 12345678
RC: 54321
Facture N° FAC-2026-001
Date: 15/03/2026
Total HT: 10 000,00 MAD
TVA 20%: 2 000,00 MAD
Total TTC: 12 000,00 MAD
"""
    parser = InvoiceParser()
    result = parser.parse_text(text)

    assert result["invoice_number"] == "FAC-2026-001"
    assert result["date"] == "2026-03-15"
    assert result["total_amount"] == 12000.00
    assert result["vat_amount"] == 2000.00
    assert result["ht_amount"] == 10000.00
    assert result["ice"] == "001234567890123"
    assert result["if_fiscal"] == "12345678"
    assert result["rc"] == "54321"
    assert result["currency"] == "MAD"
    assert result["confidence"] >= 0.80


def test_minimal_invoice():
    text = """
Facture #789
Total TTC: 1 200,50 DH
"""
    parser = InvoiceParser()
    result = parser.parse_text(text)

    assert result["invoice_number"] is not None
    assert result["total_amount"] == 1200.50
    assert result["currency"] == "MAD"


def test_template_placeholders_skipped():
    text = """
[Nom de votre société]
[Adresse]
Facture N° 123
Total TTC: 500,00 €
"""
    parser = InvoiceParser()
    result = parser.parse_text(text)

    assert result["invoice_number"] == "123"
    assert result["supplier_name"] is None or "[" not in result["supplier_name"]


if __name__ == "__main__":
    test_french_invoice_with_numero_sign()
    test_moroccan_invoice()
    test_minimal_invoice()
    test_template_placeholders_skipped()
    print("All tests passed!")
