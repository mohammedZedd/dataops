"""Calcul du score de confiance de l'extraction."""


def calculate_confidence(result: dict) -> float:
    """Score pondéré entre 0 et 1 basé sur les champs clés extraits."""
    scores = {
        "invoice_number": 0.25,
        "date": 0.20,
        "supplier_name": 0.20,
        "total_amount": 0.20,
        "vat_amount": 0.15,
    }
    total = 0.0
    for field, weight in scores.items():
        if result.get(field) is not None:
            total += weight
    return round(total, 2)
