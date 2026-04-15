"""
AI accounting agent — uses Claude (Opus 4.6) to extract structured
data + propose CGNC journal entries from uploaded documents.

Sync API to match the existing FastAPI route style.
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Optional

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)


_PROMPT_TEMPLATE = """Tu es un expert-comptable marocain (CGNC / Plan Comptable Général Marocain).
Analyse ce document et extrais TOUTES les données comptables.
{client_context}

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte (aucun texte avant/après) :

{{
  "document_type": "facture_achat|facture_vente|releve_bancaire|note_frais|autre",
  "confidence": 0.95,
  "extraction": {{
    "numero_facture": "",
    "date": "YYYY-MM-DD",
    "date_echeance": "YYYY-MM-DD ou null",
    "fournisseur": {{ "nom": "", "ice": "", "if_number": "", "rc": "", "adresse": "" }},
    "client": {{ "nom": "", "ice": "", "adresse": "" }},
    "lignes": [
      {{ "description": "", "quantite": 1, "prix_unitaire": 0.00, "taux_tva": 20,
         "montant_ht": 0.00, "montant_tva": 0.00, "montant_ttc": 0.00 }}
    ],
    "totaux": {{
      "total_ht": 0.00, "total_tva_20": 0.00, "total_tva_14": 0.00,
      "total_tva_10": 0.00, "total_tva_7": 0.00, "total_tva": 0.00,
      "total_ttc": 0.00, "remise": 0.00
    }},
    "mode_paiement": "virement|cheque|especes|traite|null",
    "devise": "MAD",
    "langue": "fr|ar|fr_ar"
  }},
  "accounting_entries": [
    {{
      "compte_debit": "6111",
      "libelle_debit": "Achats de marchandises",
      "compte_credit": "4411",
      "libelle_credit": "Fournisseurs",
      "montant": 0.00,
      "description": "Achat facture N°..."
    }}
  ],
  "tva_details": {{
    "tva_collectee": 0.00,
    "tva_deductible": 0.00,
    "regime": "droit_commun|forfait|exonere",
    "taux_principal": 20
  }},
  "alerts": [],
  "suggestions": []
}}

RÈGLES COMPTABLES MAROCAINES (CGNC) :
- Plan Comptable Général Marocain
- Taux TVA : 20% (standard), 14% (transport/banque), 10% (hôtellerie/restauration),
  7% (pharmacie/agriculture), 0% (exonéré)
- Achats : Débit 611x ou 6122/6125, Crédit 4411 (Fournisseurs)
  TVA récupérable : Débit 3455 (État TVA récupérable)
- Ventes : Débit 3421 (Clients), Crédit 711x (Ventes)
  TVA facturée : Crédit 4455 (État TVA facturée)
- Frais généraux : Débit 613x/614x, Crédit 4411
- Immobilisations : Débit 2xxx, Crédit 4411
- Retenue à la source 10% (prestations de services) :
  Débit 4411, Crédit 4435 (État impôts à payer — RAS)
- Banque : 5141 ; Caisse : 5161

Sois précis avec les identifiants fiscaux marocains :
- ICE : 15 chiffres
- IF : numéro d'identification fiscale
- RC : registre du commerce
- Patente, CNSS

Si le document est en arabe, retourne quand même le JSON en français.
Si tu n'es pas sûr d'une valeur, mets null plutôt que d'inventer.
Retourne UNIQUEMENT le JSON, aucun texte autour."""


class AIAgentService:
    def __init__(self) -> None:
        self._client: Optional[anthropic.Anthropic] = None

    def _get_client(self) -> anthropic.Anthropic:
        if not settings.ANTHROPIC_API_KEY:
            raise RuntimeError(
                "ANTHROPIC_API_KEY non configuré. "
                "Ajoutez-le dans le fichier .env du backend."
            )
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        return self._client

    def analyze_document(
        self,
        *,
        file_content: bytes,
        filename: str,
        mime_type: str,
        client_info: Optional[dict] = None,
    ) -> dict:
        """Analyze a document and return structured accounting data."""
        client = self._get_client()

        # Build the client context block
        if client_info:
            ci_lines = [
                f"- Nom : {client_info.get('full_name', '')}",
                f"- Entreprise : {client_info.get('company', '')}",
                f"- Secteur : {client_info.get('secteur_activite', '')}",
                f"- Régime fiscal : {client_info.get('regime_fiscal', '')}",
                f"- ICE : {client_info.get('ice', '')}",
            ]
            client_context = "\nInformations sur le client :\n" + "\n".join(ci_lines)
        else:
            client_context = ""

        prompt = _PROMPT_TEMPLATE.format(client_context=client_context)
        file_b64 = base64.standard_b64encode(file_content).decode("utf-8")

        # Build the content block based on MIME type
        if mime_type.startswith("image/"):
            file_block = {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": file_b64,
                },
            }
        else:
            # PDF — use document block
            file_block = {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": file_b64,
                },
            }

        try:
            response = client.messages.create(
                model="claude-opus-4-6",
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [file_block, {"type": "text", "text": prompt}],
                }],
            )

            # Extract text from response (skip non-text blocks defensively)
            text_parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
            result_text = ("".join(text_parts)).strip()

            # Strip markdown code fences if present
            if result_text.startswith("```"):
                # ```json\n...\n``` or ```\n...\n```
                stripped = result_text.lstrip("`")
                if stripped.lower().startswith("json"):
                    stripped = stripped[4:]
                # Now find the trailing ```
                end = stripped.rfind("```")
                if end != -1:
                    stripped = stripped[:end]
                result_text = stripped.strip()

            return json.loads(result_text)

        except json.JSONDecodeError as exc:
            logger.error("AI JSON parse error: %s — raw: %s", exc, result_text[:500])
            return self._fallback_result("Réponse IA non parsable (JSON invalide).")
        except anthropic.APIError as exc:
            logger.error("Anthropic API error: %s", exc)
            raise RuntimeError(f"Erreur API Claude : {exc}")
        except Exception as exc:  # pragma: no cover
            logger.exception("AI analysis unexpected error")
            raise RuntimeError(f"Erreur d'analyse IA : {exc}")

    @staticmethod
    def _fallback_result(reason: str) -> dict:
        return {
            "document_type": "autre",
            "confidence": 0,
            "extraction": {},
            "accounting_entries": [],
            "tva_details": {},
            "alerts": [reason, "Vérification manuelle requise."],
            "suggestions": [],
        }


ai_agent_service = AIAgentService()
