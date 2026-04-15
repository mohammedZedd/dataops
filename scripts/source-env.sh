#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  source-env.sh — Charge .env racine dans le shell courant
#
#  Usage (depuis la racine du projet) :
#      source scripts/source-env.sh          # charge .env
#      source scripts/source-env.sh .env     # chemin explicite
#
#  Après sourcing, aws CLI utilise automatiquement les bonnes credentials :
#      aws sts get-caller-identity
#      aws s3 ls s3://dataopsdepot
#
#  ⚠ NE PAS exécuter avec `bash scripts/source-env.sh` (crée un sous-shell).
#    Toujours utiliser `source` ou `. scripts/source-env.sh`.
# ─────────────────────────────────────────────────────────────────────────────

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌  Fichier $ENV_FILE introuvable. Lancer depuis la racine du projet." >&2
    return 1 2>/dev/null || exit 1
fi

# Charge uniquement les lignes KEY=VALUE (ignore commentaires et lignes vides)
while IFS= read -r line || [[ -n "$line" ]]; do
    # Ignorer commentaires et lignes vides
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    # Exporter la variable
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
        export "$line"
    fi
done < "$ENV_FILE"

echo "✓  Variables chargées depuis $ENV_FILE"
echo "   AWS_ACCESS_KEY_ID  = ${AWS_ACCESS_KEY_ID:0:8}...${AWS_ACCESS_KEY_ID: -4}"
echo "   AWS_REGION         = $AWS_REGION"
echo "   S3_BUCKET_NAME     = $S3_BUCKET_NAME"
echo ""
echo "   Vérifier l'identité : aws sts get-caller-identity"
