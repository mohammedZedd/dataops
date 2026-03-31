from sqlalchemy.orm import Session

from app.models.company import Company


def create_company(db: Session, name: str) -> Company:
    company = Company(name=name.strip())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company
