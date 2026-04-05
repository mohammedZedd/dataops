"""Calcul du score de confiance de l'extraction."""


def calculate_confidence(result: dict) -> float:
    """Score entre 0 et 1 basé sur le nombre de champs clés extraits."""
    key_fields = [
        "invoice_number",
        "date",
        "supplier_name",
        "total_amount",
        "vat_amount",
    ]
    filled = sum(1 for f in key_fields if result.get(f) is not None)
    return round(filled / len(key_fields), 2)
