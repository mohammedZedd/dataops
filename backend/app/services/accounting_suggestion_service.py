"""
Service de suggestion comptable basé sur le Plan Comptable Général Marocain (PCG Maroc).

Mappe (secteur_activite + direction) vers les comptes PCG suggérés.
"""
from typing import Optional

# ─── TVA rates par secteur (Maroc) ────────────────────────────────────────────

TVA_RATES: dict[str, float] = {
    "Commerce général":                   20.0,
    "Commerce de détail":                 20.0,
    "Import / Export":                    20.0,
    "BTP (Bâtiment et Travaux Publics)":  20.0,
    "Services informatiques":             20.0,
    "Conseil et expertise":               20.0,
    "Transport et logistique":            14.0,
    "Industrie manufacturière":           20.0,
    "Agriculture et agro-alimentaire":     7.0,
    "Immobilier et promotion immobilière": 20.0,
    "Hôtellerie et restauration":         10.0,
    "Santé et pharmacie":                  7.0,
    "Education et formation":              0.0,
    "Autre":                              20.0,
}

# ─── Comptes ACHAT par secteur ────────────────────────────────────────────────

_ACHAT_COMMERCE = [
    {"code": "6111", "libelle": "Achats de marchandises",               "type": "charge", "is_primary": True},
    {"code": "6113", "libelle": "Achats de matières et fournitures",    "type": "charge", "is_primary": False},
    {"code": "3455", "libelle": "État TVA récupérable sur charges",     "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
    {"code": "4415", "libelle": "Fournisseurs - effets à payer",        "type": "tiers",  "is_primary": False},
]

_ACHAT_BTP = [
    {"code": "6121", "libelle": "Achats de matières premières",         "type": "charge", "is_primary": True},
    {"code": "6125", "libelle": "Achats de matériaux de construction",  "type": "charge", "is_primary": True},
    {"code": "6132", "libelle": "Locations de matériel",                "type": "charge", "is_primary": False},
    {"code": "6133", "libelle": "Entretien et réparations",             "type": "charge", "is_primary": False},
    {"code": "3455", "libelle": "État TVA récupérable (20%)",           "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
]

_ACHAT_SERVICES = [
    {"code": "6132", "libelle": "Locations de matériel informatique",   "type": "charge", "is_primary": False},
    {"code": "6135", "libelle": "Rémunérations d'intermédiaires",       "type": "charge", "is_primary": False},
    {"code": "6141", "libelle": "Études et recherches",                 "type": "charge", "is_primary": True},
    {"code": "6145", "libelle": "Publicité et relations publiques",     "type": "charge", "is_primary": False},
    {"code": "6146", "libelle": "Transports",                          "type": "charge", "is_primary": False},
    {"code": "3455", "libelle": "État TVA récupérable (20%)",           "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
]

_ACHAT_TRANSPORT = [
    {"code": "6121", "libelle": "Achats de matières premières",         "type": "charge", "is_primary": False},
    {"code": "6146", "libelle": "Transports",                           "type": "charge", "is_primary": True},
    {"code": "6147", "libelle": "Déplacements et missions",             "type": "charge", "is_primary": False},
    {"code": "6148", "libelle": "Frais postaux",                        "type": "charge", "is_primary": False},
    {"code": "3455", "libelle": "État TVA récupérable (14%)",           "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
]

_ACHAT_INDUSTRIE = [
    {"code": "6121", "libelle": "Achats de matières premières",         "type": "charge", "is_primary": True},
    {"code": "6122", "libelle": "Achats de matières consommables",      "type": "charge", "is_primary": True},
    {"code": "6123", "libelle": "Achats d'emballages",                  "type": "charge", "is_primary": False},
    {"code": "6131", "libelle": "Sous-traitance générale",              "type": "charge", "is_primary": False},
    {"code": "3455", "libelle": "État TVA récupérable (20%)",           "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
]

_ACHAT_AGRICULTURE = [
    {"code": "6121", "libelle": "Achats de matières premières agricoles","type": "charge", "is_primary": True},
    {"code": "6124", "libelle": "Achats d'animaux et matières vivantes","type": "charge", "is_primary": False},
    {"code": "6113", "libelle": "Achats d'engrais et produits phytosanitaires", "type": "charge", "is_primary": True},
    {"code": "3455", "libelle": "État TVA récupérable (7%)",            "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
]

_ACHAT_IMMOBILIER = [
    {"code": "6121", "libelle": "Achats de matières premières",         "type": "charge", "is_primary": False},
    {"code": "6125", "libelle": "Achats de terrains (à analyser)",      "type": "charge", "is_primary": False},
    {"code": "6132", "libelle": "Locations",                            "type": "charge", "is_primary": True},
    {"code": "6133", "libelle": "Entretien et réparations",             "type": "charge", "is_primary": True},
    {"code": "3455", "libelle": "État TVA récupérable (20%)",           "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
]

_ACHAT_HOTELLERIE = [
    {"code": "6111", "libelle": "Achats de marchandises (denrées)",     "type": "charge", "is_primary": True},
    {"code": "6113", "libelle": "Achats de fournitures",                "type": "charge", "is_primary": True},
    {"code": "6132", "libelle": "Locations de matériel",                "type": "charge", "is_primary": False},
    {"code": "6141", "libelle": "Frais de publicité",                   "type": "charge", "is_primary": False},
    {"code": "3455", "libelle": "État TVA récupérable (10%)",           "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
]

_ACHAT_SANTE = [
    {"code": "6111", "libelle": "Achats de médicaments et produits",    "type": "charge", "is_primary": True},
    {"code": "6113", "libelle": "Achats de matériel médical",           "type": "charge", "is_primary": True},
    {"code": "6141", "libelle": "Honoraires médicaux",                  "type": "charge", "is_primary": False},
    {"code": "3455", "libelle": "État TVA récupérable (7%)",            "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
]

_ACHAT_EDUCATION = [
    {"code": "6135", "libelle": "Honoraires formateurs",                "type": "charge", "is_primary": True},
    {"code": "6141", "libelle": "Études et documentation",              "type": "charge", "is_primary": True},
    {"code": "6145", "libelle": "Publicité",                            "type": "charge", "is_primary": False},
    {"code": "3455", "libelle": "État TVA récupérable (20%)",           "type": "tva",    "is_primary": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",  "is_primary": True},
]

ACHAT_ACCOUNTS_BY_SECTOR: dict[str, list[dict]] = {
    "Commerce général":                    _ACHAT_COMMERCE,
    "Commerce de détail":                  _ACHAT_COMMERCE,
    "Import / Export":                     _ACHAT_COMMERCE,
    "BTP (Bâtiment et Travaux Publics)":   _ACHAT_BTP,
    "Services informatiques":              _ACHAT_SERVICES,
    "Conseil et expertise":                _ACHAT_SERVICES,
    "Transport et logistique":             _ACHAT_TRANSPORT,
    "Industrie manufacturière":            _ACHAT_INDUSTRIE,
    "Agriculture et agro-alimentaire":     _ACHAT_AGRICULTURE,
    "Immobilier et promotion immobilière": _ACHAT_IMMOBILIER,
    "Hôtellerie et restauration":          _ACHAT_HOTELLERIE,
    "Santé et pharmacie":                  _ACHAT_SANTE,
    "Education et formation":              _ACHAT_EDUCATION,
    "Autre":                               _ACHAT_COMMERCE,
}

# ─── Comptes VENTE (identiques pour tous les secteurs) ────────────────────────

VENTE_ACCOUNTS: list[dict] = [
    {"code": "7111", "libelle": "Ventes de marchandises au Maroc",      "type": "produit", "is_primary": True},
    {"code": "7121", "libelle": "Ventes de biens produits au Maroc",    "type": "produit", "is_primary": False},
    {"code": "7141", "libelle": "Travaux (BTP)",                        "type": "produit", "is_primary": False},
    {"code": "7161", "libelle": "Produits des activités annexes",       "type": "produit", "is_primary": False},
    {"code": "4455", "libelle": "État TVA facturée",                    "type": "tva",     "is_primary": True},
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "is_primary": True},
    {"code": "3425", "libelle": "Clients - effets à recevoir",          "type": "tiers",   "is_primary": False},
]


# ─── Public API ───────────────────────────────────────────────────────────────

def get_tva_rate(secteur_activite: Optional[str]) -> float:
    if not secteur_activite:
        return 20.0
    return TVA_RATES.get(secteur_activite, 20.0)


def get_suggested_accounts(
    *,
    secteur_activite: Optional[str],
    direction: str,
    total_amount: float,
    vat_amount: float,
) -> list[dict]:
    """
    Retourne la liste des comptes suggérés avec montants calculés.

    - direction: "achat" ou "vente"
    - total_amount: montant TTC
    - vat_amount: montant TVA
    """
    montant_ht = round(total_amount - vat_amount, 2)
    montant_tva = round(vat_amount, 2)
    montant_ttc = round(total_amount, 2)

    if direction == "vente":
        base_accounts = VENTE_ACCOUNTS
    else:
        base_accounts = ACHAT_ACCOUNTS_BY_SECTOR.get(
            secteur_activite or "Autre", _ACHAT_COMMERCE
        )

    result = []
    for acc in base_accounts:
        entry = dict(acc)
        if acc["type"] in ("charge", "produit"):
            entry["montant_ht"] = montant_ht
        elif acc["type"] == "tva":
            entry["montant_tva"] = montant_tva
        elif acc["type"] == "tiers":
            entry["montant_ttc"] = montant_ttc
        result.append(entry)

    return result
