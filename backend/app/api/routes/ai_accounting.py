"""AI accounting routes — analyze documents, validate analyses, journal & TVA."""
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.dependencies.auth import get_current_user
from app.models.ai_analysis import AIAnalysis, JournalEntry
from app.models.client import Client
from app.models.document import Document
from app.models.user import User, UserRole
from app.services import s3_service
from app.services.ai_agent_service import ai_agent_service

router = APIRouter(prefix="/ai", tags=["ai-accounting"])


def _check_staff(current_user: User) -> None:
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Réservé au cabinet.")


def _analysis_dict(a: AIAnalysis) -> dict:
    return {
        "id": a.id,
        "document_id": a.document_id,
        "document_type": a.document_type,
        "confidence": a.confidence,
        "extraction_data": a.extraction_data,
        "accounting_entries": a.accounting_entries,
        "tva_details": a.tva_details,
        "alerts": a.alerts or [],
        "suggestions": a.suggestions or [],
        "status": a.status,
        "validated_by_id": a.validated_by_id,
        "validated_at": a.validated_at.isoformat() if a.validated_at else None,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


def _journal_type_for(doc_type: Optional[str]) -> str:
    return {
        "facture_achat": "achats",
        "facture_vente": "ventes",
        "releve_bancaire": "banque",
        "note_frais": "achats",
        "autre": "operations_diverses",
    }.get(doc_type or "", "operations_diverses")


def _mime_for_filename(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    return {
        "pdf": "application/pdf",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(ext, "application/pdf")


# ═════════════════════════════════════════════════════════════════════════════
# Analyze
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/analyze/{document_id}")
def analyze_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_staff(current_user)

    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé.")

    # Reuse a previous successful analysis
    existing = db.scalars(select(AIAnalysis).where(AIAnalysis.document_id == document_id)).first()
    if existing and existing.status in ("done", "validated"):
        return _analysis_dict(existing)

    if existing is None:
        analysis = AIAnalysis(
            document_id=document_id,
            company_id=current_user.company_id,
            status="processing",
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
    else:
        analysis = existing
        analysis.status = "processing"
        db.commit()

    try:
        # Download from S3
        try:
            file_content = s3_service.download_file(doc.s3_key)
        except Exception as exc:
            raise RuntimeError(f"Téléchargement S3 échoué : {exc}")

        # Build client info context
        client_info: Optional[dict] = None
        if doc.client_id:
            client = db.get(Client, doc.client_id)
            if client:
                client_info = {
                    "full_name": client.name,
                    "company": client.name,
                    "secteur_activite": getattr(client, "secteur_activite", None) or "",
                    "regime_fiscal": getattr(client, "regime_fiscal", None) or "",
                    "ice": getattr(client, "ice", None) or "",
                }

        mime_type = _mime_for_filename(doc.file_name)
        result = ai_agent_service.analyze_document(
            file_content=file_content,
            filename=doc.file_name,
            mime_type=mime_type,
            client_info=client_info,
        )

        analysis.document_type = result.get("document_type")
        analysis.confidence = float(result.get("confidence") or 0)
        analysis.extraction_data = result.get("extraction")
        analysis.accounting_entries = result.get("accounting_entries")
        analysis.tva_details = result.get("tva_details")
        analysis.alerts = result.get("alerts") or []
        analysis.suggestions = result.get("suggestions") or []
        analysis.status = "done"
        analysis.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(analysis)
        return _analysis_dict(analysis)

    except Exception as exc:
        analysis.status = "failed"
        analysis.alerts = [str(exc)]
        analysis.updated_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=500, detail=f"Analyse échouée : {exc}")


@router.get("/analysis/{document_id}")
def get_analysis(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_staff(current_user)
    a = db.scalars(
        select(AIAnalysis).where(
            AIAnalysis.document_id == document_id,
            AIAnalysis.company_id == current_user.company_id,
        )
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Aucune analyse pour ce document.")
    return _analysis_dict(a)


# ═════════════════════════════════════════════════════════════════════════════
# Validate (creates journal entries)
# ═════════════════════════════════════════════════════════════════════════════

class ValidateRequest(BaseModel):
    accounting_entries: Optional[list[dict[str, Any]]] = None


@router.post("/validate/{analysis_id}")
def validate_analysis(
    analysis_id: str,
    payload: ValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_staff(current_user)

    analysis = db.scalars(
        select(AIAnalysis).where(
            AIAnalysis.id == analysis_id,
            AIAnalysis.company_id == current_user.company_id,
        )
    ).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analyse non trouvée.")

    entries_to_save = payload.accounting_entries or analysis.accounting_entries or []
    if not entries_to_save:
        raise HTTPException(status_code=400, detail="Aucune écriture à enregistrer.")

    doc = db.get(Document, analysis.document_id) if analysis.document_id else None

    # Pick entry_date from extraction.date if available
    entry_date = datetime.utcnow()
    extraction = analysis.extraction_data or {}
    if isinstance(extraction, dict) and extraction.get("date"):
        try:
            entry_date = datetime.fromisoformat(extraction["date"])
        except (ValueError, TypeError):
            pass

    journal_type = _journal_type_for(analysis.document_type)
    created = 0
    for e in entries_to_save:
        if not e.get("compte_debit") or not e.get("compte_credit"):
            continue
        je = JournalEntry(
            company_id=current_user.company_id,
            document_id=analysis.document_id,
            ai_analysis_id=analysis.id,
            client_id=doc.client_id if doc else None,
            journal_type=journal_type,
            entry_date=entry_date,
            description=e.get("description", "")[:500],
            compte_debit=str(e.get("compte_debit", ""))[:20],
            libelle_debit=(e.get("libelle_debit") or "")[:255],
            compte_credit=str(e.get("compte_credit", ""))[:20],
            libelle_credit=(e.get("libelle_credit") or "")[:255],
            montant=float(e.get("montant") or 0),
            is_validated=True,
            created_by_id=current_user.id,
        )
        db.add(je)
        created += 1

    analysis.status = "validated"
    analysis.validated_by_id = current_user.id
    analysis.validated_at = datetime.utcnow()
    analysis.corrections = {"accounting_entries": payload.accounting_entries} if payload.accounting_entries else None
    analysis.updated_at = datetime.utcnow()

    db.commit()
    return {"status": "validated", "entries_created": created}


# ═════════════════════════════════════════════════════════════════════════════
# Journal listing
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/journal/{client_id}")
def get_journal(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_staff(current_user)
    entries = db.scalars(
        select(JournalEntry).where(
            JournalEntry.company_id == current_user.company_id,
            JournalEntry.client_id == client_id,
        ).order_by(JournalEntry.entry_date.desc())
    ).all()
    return [
        {
            "id": e.id,
            "journal_type": e.journal_type,
            "entry_date": e.entry_date.isoformat(),
            "description": e.description,
            "compte_debit": e.compte_debit,
            "libelle_debit": e.libelle_debit,
            "compte_credit": e.compte_credit,
            "libelle_credit": e.libelle_credit,
            "montant": e.montant,
            "is_validated": e.is_validated,
        }
        for e in entries
    ]


# ═════════════════════════════════════════════════════════════════════════════
# TVA summary
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/tva/{client_id}")
def get_tva_summary(
    client_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_staff(current_user)
    now = datetime.utcnow()
    target_month = month or now.month
    target_year = year or now.year

    start = datetime(target_year, target_month, 1)
    if target_month == 12:
        end = datetime(target_year + 1, 1, 1)
    else:
        end = datetime(target_year, target_month + 1, 1)

    entries = db.scalars(
        select(JournalEntry).where(
            JournalEntry.company_id == current_user.company_id,
            JournalEntry.client_id == client_id,
            JournalEntry.entry_date >= start,
            JournalEntry.entry_date < end,
            JournalEntry.is_validated == True,  # noqa: E712
        )
    ).all()

    # CGNC: 4455 = TVA facturée (collectée), 3455 = TVA récupérable (déductible)
    tva_collectee = sum(e.montant for e in entries if e.compte_credit == "4455")
    tva_deductible = sum(e.montant for e in entries if e.compte_debit == "3455")
    tva_nette = tva_collectee - tva_deductible

    return {
        "period": f"{target_month:02d}/{target_year}",
        "tva_collectee": round(tva_collectee, 2),
        "tva_deductible": round(tva_deductible, 2),
        "tva_nette": round(tva_nette, 2),
        "a_payer": tva_nette > 0,
        "credit_tva": tva_nette < 0,
        "entries_count": len(entries),
    }
