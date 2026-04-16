"""
Service de suggestion comptable basé sur le Plan Comptable Général Marocain (PCGM).

Conforme à :
  - Plan Comptable Général Marocain (PCGM)
  - Loi de Finances Maroc 2024/2025
  - Réglementation DGI Maroc (TVA, IS, IR)
"""
from typing import Optional

# ─── TVA rates par secteur (DGI Maroc 2024) ─────────────────────────────────

TVA_RATES: dict[str, float] = {
    "Commerce général (import/export, négoce)": 20.0,
    "Commerce de détail":                       20.0,
    "Grande distribution":                      20.0,
    "Import / Export":                           20.0,
    "BTP (Bâtiment et Travaux Publics)":         20.0,
    "Promotion immobilière":                     20.0,
    "Services informatiques et numérique":       20.0,
    "Conseil et expertise comptable":            20.0,
    "Professions libérales (médecin, avocat, architecte, notaire)": 20.0,
    "Transport routier de marchandises":         14.0,
    "Transport de voyageurs":                    14.0,
    "Logistique et entreposage":                 20.0,
    "Industrie manufacturière":                  20.0,
    "Industrie agroalimentaire":                 20.0,
    "Agriculture et élevage":                     7.0,
    "Pêche et aquaculture":                       0.0,
    "Mines et carrières":                        20.0,
    "Artisanat":                                 20.0,
    "Hôtellerie et hébergement":                 10.0,
    "Restauration et cafés":                     10.0,
    "Télécommunications":                        20.0,
    "Banque et établissements de crédit":        10.0,
    "Assurance":                                 14.0,
    "Santé (cliniques, cabinets médicaux)":       0.0,
    "Pharmacie et parapharmacie":                 7.0,
    "Education et formation professionnelle":     0.0,
    "Média et communication":                    20.0,
    "Énergie et environnement":                  14.0,
    "Autre":                                     20.0,
}

TVA_REGIME_LABELS: dict[float, str] = {
    20.0: "normale",
    14.0: "intermédiaire",
    10.0: "réduite 10%",
    7.0:  "réduite 7%",
    0.0:  "exonéré",
}

# ─── Retenue à la source par secteur ─────────────────────────────────────────

RETENUE_SOURCE_BY_SECTOR: dict[str, dict] = {
    "Conseil et expertise comptable": {
        "applicable": True, "taux": 10, "compte": "4435",
        "libelle": "Retenue à la source sur honoraires",
        "note": "Applicable si prestataire personne physique (IR Maroc)",
    },
    "Professions libérales (médecin, avocat, architecte, notaire)": {
        "applicable": True, "taux": 10, "compte": "4435",
        "libelle": "Retenue à la source sur honoraires",
        "note": "Applicable si prestataire personne physique",
    },
    "Services informatiques et numérique": {
        "applicable": True, "taux": 10, "compte": "4435",
        "libelle": "Retenue à la source sur honoraires",
        "note": "Applicable si prestataire personne physique",
    },
    "Santé (cliniques, cabinets médicaux)": {
        "applicable": True, "taux": 10, "compte": "4435",
        "libelle": "Retenue à la source sur honoraires médecins consultants",
        "note": "Applicable si médecin consultant personne physique",
    },
    "Education et formation professionnelle": {
        "applicable": True, "taux": 10, "compte": "4435",
        "libelle": "Retenue à la source sur honoraires formateurs",
        "note": "Applicable si formateur personne physique",
    },
}

_DEFAULT_RETENUE = {"applicable": False, "taux": 0, "compte": None, "libelle": None, "note": None}

# ─── Comptes ACHAT par secteur (PCGM) ────────────────────────────────────────

_ACHAT_COMMERCE = [
    {"code": "6111", "libelle": "Achats de marchandises",            "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6119", "libelle": "RRR obtenus sur achats de march.",  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable sur charges", "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                      "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "4415", "libelle": "Fournisseurs, effets à payer",      "type": "tiers",   "sens": "credit", "is_primary": False, "obligatoire": False},
]

_ACHAT_BTP = [
    {"code": "6121", "libelle": "Achats de matières premières",             "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6125", "libelle": "Achats de matériaux et fourn. de chantier","type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6131", "libelle": "Sous-traitance générale",                  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6132", "libelle": "Locations et charges locatives",            "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6133", "libelle": "Entretien et réparations",                  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6147", "libelle": "Déplacements, missions et réceptions",      "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",               "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3456", "libelle": "État, TVA récupérable sur immobilisations", "type": "tva",     "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "4411", "libelle": "Fournisseurs",                              "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "4416", "libelle": "Fournisseurs, retenues de garantie",        "type": "tiers",   "sens": "credit", "is_primary": False, "obligatoire": False},
]

_ACHAT_PROMOTION_IMMO = [
    {"code": "6121", "libelle": "Achats de matières premières",             "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6125", "libelle": "Achats de terrains et constructions",       "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6132", "libelle": "Locations",                                 "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6133", "libelle": "Entretien et réparations",                  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",               "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3456", "libelle": "État, TVA récupérable sur immobilisations", "type": "tva",     "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "4411", "libelle": "Fournisseurs",                              "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_SERVICES_INFO = [
    {"code": "6132", "libelle": "Locations de matériel informatique et licences",  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6135", "libelle": "Rémunérations d'intermédiaires et honoraires",    "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6141", "libelle": "Études, recherches et documentation",              "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6145", "libelle": "Publicité, publications et relations publiques",   "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6152", "libelle": "Primes d'assurances matériel",                     "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6165", "libelle": "Frais de télécommunications",                      "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",                      "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                                     "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_CONSEIL = [
    {"code": "6135", "libelle": "Honoraires et rémunérations d'intermédiaires",  "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6141", "libelle": "Études et recherches",                           "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6145", "libelle": "Publicité",                                      "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6147", "libelle": "Déplacements et missions",                       "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6165", "libelle": "Frais de télécommunications",                    "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",                    "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                                   "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "4413", "libelle": "Fournisseurs, retenues de garantie",             "type": "tiers",   "sens": "credit", "is_primary": False, "obligatoire": False},
]

_ACHAT_TRANSPORT_MARCHANDISES = [
    {"code": "6121", "libelle": "Achats de carburant et lubrifiants",   "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6122", "libelle": "Achats de pièces de rechange",         "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6132", "libelle": "Locations de véhicules",                "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6133", "libelle": "Entretien et réparations véhicules",    "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6147", "libelle": "Déplacements et missions",              "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6152", "libelle": "Primes d'assurances (RC, tous risques)","type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (14%)",           "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                          "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_TRANSPORT_VOYAGEURS = [
    {"code": "6121", "libelle": "Carburant",                          "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6133", "libelle": "Entretien et réparations",           "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6152", "libelle": "Assurances",                         "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (14%)",        "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                       "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_LOGISTIQUE = [
    {"code": "6121", "libelle": "Achats de matières et fournitures",  "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6132", "libelle": "Locations entrepôts et matériel",     "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6133", "libelle": "Entretien et réparations",            "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6152", "libelle": "Primes d'assurances",                 "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",         "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                        "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_INDUSTRIE = [
    {"code": "6121", "libelle": "Achats de matières premières",              "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6122", "libelle": "Achats de matières et fournitures consom.", "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6123", "libelle": "Achats d'emballages et conditionnements",   "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6131", "libelle": "Sous-traitance générale",                   "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6133", "libelle": "Entretien et réparations",                  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6152", "libelle": "Primes d'assurances",                       "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",               "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3456", "libelle": "État, TVA récupérable sur immobilisations", "type": "tva",     "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "4411", "libelle": "Fournisseurs",                              "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_AGROALIMENTAIRE = [
    {"code": "6121", "libelle": "Achats de matières premières agricoles",    "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6122", "libelle": "Achats de matières consommables",           "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6123", "libelle": "Achats d'emballages",                       "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6131", "libelle": "Sous-traitance générale",                   "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",               "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                              "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_AGRICULTURE = [
    {"code": "6121", "libelle": "Achats de semences et plants",               "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6122", "libelle": "Achats d'engrais et produits phytosanitaires","type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6124", "libelle": "Achats d'animaux (élevage)",                  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6125", "libelle": "Achats d'aliments pour animaux",              "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6132", "libelle": "Locations de matériel agricole",              "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (7%/14%)",              "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                                "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_PECHE = [
    {"code": "6121", "libelle": "Achats de matières premières (appâts, etc.)","type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6122", "libelle": "Carburant bateaux",                          "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6133", "libelle": "Entretien bateaux et matériel",              "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6152", "libelle": "Assurances maritimes",                       "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable",                      "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                               "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_MINES = [
    {"code": "6121", "libelle": "Achats de matières premières (explosifs, etc.)", "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6122", "libelle": "Fournitures consommables",                       "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6131", "libelle": "Sous-traitance",                                 "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6133", "libelle": "Entretien matériel minier",                      "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",                    "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3456", "libelle": "TVA sur immobilisations (machines)",             "type": "tva",     "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "4411", "libelle": "Fournisseurs",                                   "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_ARTISANAT = [
    {"code": "6121", "libelle": "Achats de matières premières (cuir, bois, laine)", "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6122", "libelle": "Fournitures et petit matériel",                     "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6133", "libelle": "Entretien outillage",                               "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%/7%)",                    "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                                      "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_HOTELLERIE = [
    {"code": "6111", "libelle": "Achats de marchandises (linge, équipements)", "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6113", "libelle": "Achats de fournitures hôtelières",            "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6121", "libelle": "Achats alimentaires",                         "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6132", "libelle": "Locations (linge, matériel)",                 "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6133", "libelle": "Entretien et réparations",                    "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6152", "libelle": "Assurances",                                  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (10%)",                 "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                                "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_RESTAURATION = [
    {"code": "6111", "libelle": "Achats de denrées alimentaires",      "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6113", "libelle": "Fournitures de cuisine et salle",     "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6121", "libelle": "Boissons et produits divers",         "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6133", "libelle": "Entretien matériel de cuisine",       "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (10%)",         "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                        "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_TELECOMS = [
    {"code": "6132", "libelle": "Locations de matériel et licences",    "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6135", "libelle": "Rémunérations d'intermédiaires",       "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6141", "libelle": "Études et recherches",                  "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6165", "libelle": "Frais de télécommunications",           "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",           "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                          "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_BANQUE = [
    {"code": "6135", "libelle": "Commissions et honoraires",           "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6152", "libelle": "Assurances",                          "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6165", "libelle": "Télécommunications",                  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6141", "libelle": "Études et informatique",              "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (10%)",         "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                        "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_ASSURANCE = [
    {"code": "6135", "libelle": "Commissions agents",                  "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6141", "libelle": "Études actuarielles",                 "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6165", "libelle": "Télécommunications",                  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (14%)",         "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                        "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_SANTE = [
    {"code": "6111", "libelle": "Achats de médicaments et consommables médicaux", "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6113", "libelle": "Fournitures médicales et matériel jetable",      "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6132", "libelle": "Locations matériel médical",                      "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6133", "libelle": "Maintenance équipements médicaux",                "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6135", "libelle": "Honoraires médecins consultants",                 "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (7%)",                      "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                                    "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_PHARMACIE = [
    {"code": "6111", "libelle": "Achats de médicaments (TVA 7%)",       "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6112", "libelle": "Achats produits parapharmacie (TVA 20%)", "type": "charge","sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6113", "libelle": "Emballages et conditionnements",       "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (7%/20%)",       "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                         "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_EDUCATION = [
    {"code": "6135", "libelle": "Honoraires formateurs et intervenants",  "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6141", "libelle": "Documentation et fournitures pédag.",     "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6132", "libelle": "Locations salles et équipements",         "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6145", "libelle": "Publicité et communication",              "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20% sur charges)", "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                            "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_MEDIA = [
    {"code": "6135", "libelle": "Rémunérations d'intermédiaires",       "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6141", "libelle": "Études et recherches",                  "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6145", "libelle": "Publicité et relations publiques",      "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6165", "libelle": "Frais de télécommunications",           "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (20%)",           "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "4411", "libelle": "Fournisseurs",                          "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_ACHAT_ENERGIE = [
    {"code": "6121", "libelle": "Matières premières et combustibles",    "type": "charge",  "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "6131", "libelle": "Sous-traitance travaux",                "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "6133", "libelle": "Entretien équipements",                 "type": "charge",  "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "3455", "libelle": "État, TVA récupérable (14%/20%)",       "type": "tva",     "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3456", "libelle": "TVA sur immobilisations",               "type": "tva",     "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "4411", "libelle": "Fournisseurs",                          "type": "tiers",   "sens": "credit", "is_primary": True,  "obligatoire": True},
]

# ─── Mapping secteur → comptes achat ─────────────────────────────────────────

ACHAT_ACCOUNTS_BY_SECTOR: dict[str, list[dict]] = {
    "Commerce général (import/export, négoce)": _ACHAT_COMMERCE,
    "Commerce de détail":                       _ACHAT_COMMERCE,
    "Grande distribution":                      _ACHAT_COMMERCE,
    "Import / Export":                           _ACHAT_COMMERCE,
    "BTP (Bâtiment et Travaux Publics)":         _ACHAT_BTP,
    "Promotion immobilière":                     _ACHAT_PROMOTION_IMMO,
    "Services informatiques et numérique":       _ACHAT_SERVICES_INFO,
    "Conseil et expertise comptable":            _ACHAT_CONSEIL,
    "Professions libérales (médecin, avocat, architecte, notaire)": _ACHAT_CONSEIL,
    "Transport routier de marchandises":         _ACHAT_TRANSPORT_MARCHANDISES,
    "Transport de voyageurs":                    _ACHAT_TRANSPORT_VOYAGEURS,
    "Logistique et entreposage":                 _ACHAT_LOGISTIQUE,
    "Industrie manufacturière":                  _ACHAT_INDUSTRIE,
    "Industrie agroalimentaire":                 _ACHAT_AGROALIMENTAIRE,
    "Agriculture et élevage":                    _ACHAT_AGRICULTURE,
    "Pêche et aquaculture":                      _ACHAT_PECHE,
    "Mines et carrières":                        _ACHAT_MINES,
    "Artisanat":                                 _ACHAT_ARTISANAT,
    "Hôtellerie et hébergement":                 _ACHAT_HOTELLERIE,
    "Restauration et cafés":                     _ACHAT_RESTAURATION,
    "Télécommunications":                        _ACHAT_TELECOMS,
    "Banque et établissements de crédit":        _ACHAT_BANQUE,
    "Assurance":                                 _ACHAT_ASSURANCE,
    "Santé (cliniques, cabinets médicaux)":      _ACHAT_SANTE,
    "Pharmacie et parapharmacie":                _ACHAT_PHARMACIE,
    "Education et formation professionnelle":    _ACHAT_EDUCATION,
    "Média et communication":                    _ACHAT_MEDIA,
    "Énergie et environnement":                  _ACHAT_ENERGIE,
    "Autre":                                     _ACHAT_COMMERCE,
}

# ─── Comptes VENTE par secteur (PCGM) ────────────────────────────────────────

_VENTE_COMMERCE = [
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3425", "libelle": "Clients, effets à recevoir",           "type": "tiers",   "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "7111", "libelle": "Ventes de marchandises au Maroc",      "type": "produit", "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "7119", "libelle": "RRR accordés par l'entreprise",        "type": "produit", "sens": "credit", "is_primary": False, "obligatoire": False},
    {"code": "4441", "libelle": "État, TVA facturée",                   "type": "tva",     "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_VENTE_BTP = [
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3425", "libelle": "Clients, effets à recevoir",           "type": "tiers",   "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "7141", "libelle": "Travaux",                              "type": "produit", "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "4441", "libelle": "État, TVA facturée (20%)",             "type": "tva",     "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "4416", "libelle": "Clients, retenues de garantie",        "type": "tiers",   "sens": "credit", "is_primary": False, "obligatoire": False},
]

_VENTE_PROMOTION_IMMO = [
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "7121", "libelle": "Ventes de biens immeubles",            "type": "produit", "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "4441", "libelle": "État, TVA facturée (20%)",             "type": "tva",     "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_VENTE_SERVICES = [
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3425", "libelle": "Clients, effets à recevoir",           "type": "tiers",   "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "7161", "libelle": "Prestations de services",              "type": "produit", "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "7165", "libelle": "Honoraires",                           "type": "produit", "sens": "credit", "is_primary": False, "obligatoire": False},
    {"code": "4441", "libelle": "État, TVA facturée (20%)",             "type": "tva",     "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_VENTE_TRANSPORT = [
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "7161", "libelle": "Prestations de transport",             "type": "produit", "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "4441", "libelle": "État, TVA facturée (14%)",             "type": "tva",     "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_VENTE_HOTELLERIE = [
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "5141", "libelle": "Banque (règlements immédiats)",        "type": "tiers",   "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "5161", "libelle": "Caisse",                               "type": "tiers",   "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "7111", "libelle": "Ventes (restauration)",                "type": "produit", "sens": "credit", "is_primary": False, "obligatoire": False},
    {"code": "7161", "libelle": "Prestations hébergement",              "type": "produit", "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "4441", "libelle": "État, TVA facturée (10%)",             "type": "tva",     "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_VENTE_AGRICULTURE = [
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "7121", "libelle": "Ventes de produits finis agricoles",    "type": "produit", "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_VENTE_SANTE_EDUCATION = [
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "5161", "libelle": "Caisse (paiements directs)",           "type": "tiers",   "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "7161", "libelle": "Prestations (exonérées TVA)",          "type": "produit", "sens": "credit", "is_primary": True,  "obligatoire": True},
]

_VENTE_INDUSTRIE = [
    {"code": "3421", "libelle": "Clients",                              "type": "tiers",   "sens": "debit",  "is_primary": True,  "obligatoire": True},
    {"code": "3425", "libelle": "Clients, effets à recevoir",           "type": "tiers",   "sens": "debit",  "is_primary": False, "obligatoire": False},
    {"code": "7121", "libelle": "Ventes de biens produits au Maroc",    "type": "produit", "sens": "credit", "is_primary": True,  "obligatoire": True},
    {"code": "4441", "libelle": "État, TVA facturée (20%)",             "type": "tva",     "sens": "credit", "is_primary": True,  "obligatoire": True},
]

VENTE_ACCOUNTS_BY_SECTOR: dict[str, list[dict]] = {
    "Commerce général (import/export, négoce)": _VENTE_COMMERCE,
    "Commerce de détail":                       _VENTE_COMMERCE,
    "Grande distribution":                      _VENTE_COMMERCE,
    "Import / Export":                           _VENTE_COMMERCE,
    "BTP (Bâtiment et Travaux Publics)":         _VENTE_BTP,
    "Promotion immobilière":                     _VENTE_PROMOTION_IMMO,
    "Services informatiques et numérique":       _VENTE_SERVICES,
    "Conseil et expertise comptable":            _VENTE_SERVICES,
    "Professions libérales (médecin, avocat, architecte, notaire)": _VENTE_SERVICES,
    "Transport routier de marchandises":         _VENTE_TRANSPORT,
    "Transport de voyageurs":                    _VENTE_TRANSPORT,
    "Logistique et entreposage":                 _VENTE_SERVICES,
    "Industrie manufacturière":                  _VENTE_INDUSTRIE,
    "Industrie agroalimentaire":                 _VENTE_INDUSTRIE,
    "Agriculture et élevage":                    _VENTE_AGRICULTURE,
    "Pêche et aquaculture":                      _VENTE_AGRICULTURE,
    "Mines et carrières":                        _VENTE_INDUSTRIE,
    "Artisanat":                                 _VENTE_COMMERCE,
    "Hôtellerie et hébergement":                 _VENTE_HOTELLERIE,
    "Restauration et cafés":                     _VENTE_HOTELLERIE,
    "Télécommunications":                        _VENTE_SERVICES,
    "Banque et établissements de crédit":        _VENTE_SERVICES,
    "Assurance":                                 _VENTE_SERVICES,
    "Santé (cliniques, cabinets médicaux)":      _VENTE_SANTE_EDUCATION,
    "Pharmacie et parapharmacie":                _VENTE_COMMERCE,
    "Education et formation professionnelle":    _VENTE_SANTE_EDUCATION,
    "Média et communication":                    _VENTE_SERVICES,
    "Énergie et environnement":                  _VENTE_INDUSTRIE,
    "Autre":                                     _VENTE_COMMERCE,
}

# ─── Sectors exonérés de TVA ─────────────────────────────────────────────────

SECTEURS_EXONERES = {
    "Agriculture et élevage",
    "Pêche et aquaculture",
    "Santé (cliniques, cabinets médicaux)",
    "Education et formation professionnelle",
}

# ─── Journal mapping ─────────────────────────────────────────────────────────

def get_journal(direction: str) -> str:
    return "ACHATS" if direction == "achat" else "VENTES"


# ─── Public API ──────────────────────────────────────────────────────────────

def get_tva_rate(secteur_activite: Optional[str]) -> float:
    if not secteur_activite:
        return 20.0
    return TVA_RATES.get(secteur_activite, 20.0)


def get_tva_regime(tva_rate: float) -> str:
    return TVA_REGIME_LABELS.get(tva_rate, "normale")


def get_retenue_source(secteur_activite: Optional[str], direction: str) -> dict:
    if direction != "achat" or not secteur_activite:
        return dict(_DEFAULT_RETENUE)
    return RETENUE_SOURCE_BY_SECTOR.get(secteur_activite, dict(_DEFAULT_RETENUE))


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
        base_accounts = VENTE_ACCOUNTS_BY_SECTOR.get(
            secteur_activite or "Autre", _VENTE_COMMERCE
        )
    else:
        base_accounts = ACHAT_ACCOUNTS_BY_SECTOR.get(
            secteur_activite or "Autre", _ACHAT_COMMERCE
        )

    result = []
    for acc in base_accounts:
        entry = dict(acc)
        if acc["type"] in ("charge", "produit"):
            entry["montant"] = montant_ht
        elif acc["type"] == "tva":
            entry["montant"] = montant_tva
        elif acc["type"] == "tiers":
            entry["montant"] = montant_ttc
        result.append(entry)

    return result
