#!/usr/bin/env python3
"""
Script de validation de la configuration AWS.
Vérifie STS (identité), S3 (bucket), SES (sender), Textract (accès).

Usage:
    python scripts/check_aws.py
    python scripts/check_aws.py --env backend/.env
"""
import argparse
import os
import sys
from pathlib import Path


def load_env(path: str) -> None:
    """Charge un fichier .env dans os.environ (sans dépendance externe)."""
    p = Path(path)
    if not p.exists():
        print(f"[WARN] Fichier .env introuvable : {path}")
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def check_sts(boto3, region: str) -> bool:
    print("\n── STS (identité IAM) ───────────────────────────────────────────")
    try:
        client = boto3.client("sts", region_name=region)
        identity = client.get_caller_identity()
        print(f"  ✓ UserId  : {identity['UserId']}")
        print(f"  ✓ Account : {identity['Account']}")
        print(f"  ✓ ARN     : {identity['Arn']}")
        return True
    except Exception as e:
        print(f"  ✗ Erreur  : {e}")
        return False


def check_s3(boto3, region: str, bucket: str) -> bool:
    print(f"\n── S3 (bucket: {bucket}) ──────────────────────────────────────────")
    try:
        client = boto3.client("s3", region_name=region)
        client.head_bucket(Bucket=bucket)
        print(f"  ✓ Bucket accessible")

        response = client.list_objects_v2(Bucket=bucket, MaxKeys=3)
        count = response.get("KeyCount", 0)
        print(f"  ✓ Objets récupérés (échantillon) : {count}")
        return True
    except Exception as e:
        err = str(e)
        if "403" in err or "Forbidden" in err:
            print(f"  ✗ Accès refusé (403) — politique IAM manquante :")
            print(f"     → Ajouter s3:GetObject, s3:PutObject, s3:DeleteObject, s3:ListBucket")
            print(f"     → Sur la ressource : arn:aws:s3:::{bucket}/*")
        elif "404" in err or "NoSuchBucket" in err:
            print(f"  ✗ Bucket introuvable — vérifier S3_BUCKET_NAME et la région")
        else:
            print(f"  ✗ Erreur  : {e}")
        return False


def check_ses(boto3, region: str, sender: str) -> bool:
    print(f"\n── SES (sender: {sender}) ─────────────────────────────────────────")
    try:
        client = boto3.client("ses", region_name=region)
        response = client.get_identity_verification_attributes(Identities=[sender])
        attrs = response.get("VerificationAttributes", {})
        status = attrs.get(sender, {}).get("VerificationStatus", "NotFound")
        if status == "Success":
            print(f"  ✓ Identité vérifiée : {sender}")
        else:
            print(f"  ⚠ Identité status={status} (non vérifiée ou absente dans SES)")
        return True
    except Exception as e:
        if "AccessDenied" in str(e):
            print(f"  ✗ Accès refusé — politique IAM manquante :")
            print(f"     → Ajouter ses:SendEmail, ses:GetIdentityVerificationAttributes")
            print(f"     → Sur la ressource : arn:aws:ses:{region}:*:identity/{sender}")
        else:
            print(f"  ✗ Erreur  : {e}")
        return False


def check_textract(boto3, region: str) -> bool:
    print(f"\n── Textract (region: {region}) ────────────────────────────────────")
    try:
        client = boto3.client("textract", region_name=region)
        # list_adapters est léger et ne consomme pas de crédits
        client.list_adapters(MaxResults=1)
        print(f"  ✓ Accès Textract OK")
        return True
    except Exception as e:
        code = getattr(getattr(e, "response", {}), "get", lambda *a: "")("Error", {}).get("Code", "")
        if "AccessDenied" in str(e):
            print(f"  ⚠ Accès refusé (clé valide mais pas de permission Textract)")
        elif "not subscribed" in str(e).lower() or "not available" in str(e).lower():
            print(f"  ⚠ Textract non disponible dans {region}")
        else:
            print(f"  ✗ Erreur  : {e}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Valide la configuration AWS du projet")
    parser.add_argument("--env", default="backend/.env", help="Chemin vers le fichier .env (défaut: backend/.env)")
    args = parser.parse_args()

    load_env(args.env)

    key_id = os.environ.get("AWS_ACCESS_KEY_ID", "")
    secret = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    region = os.environ.get("AWS_REGION", "eu-west-3")
    bucket = os.environ.get("S3_BUCKET_NAME", "dataopsdepot")
    sender = os.environ.get("SES_SENDER_EMAIL", "noreply@dataops.ma")

    print("═══════════════════════════════════════════════════════════════════")
    print("   Validation configuration AWS — ComptaFlow")
    print("═══════════════════════════════════════════════════════════════════")
    print(f"  Fichier .env : {args.env}")
    print(f"  Key ID       : {key_id[:8]}...{key_id[-4:] if key_id else '(vide)'}")
    print(f"  Region       : {region}")
    print(f"  Bucket S3    : {bucket}")
    print(f"  SES sender   : {sender}")

    if not key_id or not secret:
        print("\n✗ ERREUR : AWS_ACCESS_KEY_ID ou AWS_SECRET_ACCESS_KEY manquant dans .env")
        sys.exit(1)

    try:
        import boto3
    except ImportError:
        print("\n✗ boto3 non installé. Lancer : pip install boto3")
        sys.exit(1)

    # Injecter les credentials directement (évite de dépendre du profil local)
    os.environ["AWS_ACCESS_KEY_ID"] = key_id
    os.environ["AWS_SECRET_ACCESS_KEY"] = secret
    os.environ["AWS_DEFAULT_REGION"] = region

    results = {
        "STS":       check_sts(boto3, region),
        "S3":        check_s3(boto3, region, bucket),
        "SES":       check_ses(boto3, region, sender),
        "Textract":  check_textract(boto3, region),
    }

    print("\n═══════════════════════════════════════════════════════════════════")
    print("   Résumé")
    print("═══════════════════════════════════════════════════════════════════")
    all_ok = True
    for service, ok in results.items():
        icon = "✓" if ok else "✗"
        print(f"  {icon} {service}")
        if not ok:
            all_ok = False

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
