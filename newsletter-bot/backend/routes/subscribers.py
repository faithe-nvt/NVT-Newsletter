from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import csv
import io

from database import get_db
from models import Subscriber, SubscriberSource

router = APIRouter(prefix="/subscribers", tags=["subscribers"])


class SubscriberCreate(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = "accounting"


class SubscriberOut(BaseModel):
    id: int
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    company: Optional[str]
    industry: Optional[str]
    source: str
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[dict])
def list_subscribers(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(Subscriber)
    if active_only:
        q = q.filter(Subscriber.is_active == True)
    subs = q.offset(skip).limit(limit).all()
    return [
        {
            "id": s.id,
            "email": s.email,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "company": s.company,
            "industry": s.industry,
            "source": s.source,
            "is_active": s.is_active,
            "created_at": str(s.created_at),
        }
        for s in subs
    ]


@router.get("/stats")
def subscriber_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Subscriber.id)).scalar()
    active = db.query(func.count(Subscriber.id)).filter(Subscriber.is_active == True).scalar()
    by_source = (
        db.query(Subscriber.source, func.count(Subscriber.id))
        .group_by(Subscriber.source)
        .all()
    )
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "by_source": {s: c for s, c in by_source},
    }


@router.post("/", response_model=dict)
def create_subscriber(data: SubscriberCreate, db: Session = Depends(get_db)):
    existing = db.query(Subscriber).filter(Subscriber.email == data.email).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.commit()
            return {"id": existing.id, "status": "reactivated"}
        raise HTTPException(status_code=409, detail="Email already subscribed")

    sub = Subscriber(
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        company=data.company,
        industry=data.industry,
        source=SubscriberSource.form,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "status": "created"}


@router.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    created = 0
    skipped = 0
    errors = []

    for row in reader:
        email = (row.get("email") or row.get("Email") or "").strip()
        if not email:
            continue
        try:
            existing = db.query(Subscriber).filter(Subscriber.email == email).first()
            if existing:
                skipped += 1
                continue
            sub = Subscriber(
                email=email,
                first_name=(row.get("first_name") or row.get("First Name") or "").strip() or None,
                last_name=(row.get("last_name") or row.get("Last Name") or "").strip() or None,
                company=(row.get("company") or row.get("Company") or "").strip() or None,
                industry=(row.get("industry") or "accounting").strip(),
                source=SubscriberSource.csv,
            )
            db.add(sub)
            created += 1
        except Exception as e:
            errors.append(f"{email}: {str(e)}")

    db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


@router.delete("/{subscriber_id}")
def deactivate_subscriber(subscriber_id: int, db: Session = Depends(get_db)):
    sub = db.query(Subscriber).filter(Subscriber.id == subscriber_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    sub.is_active = False
    db.commit()
    return {"status": "deactivated"}


@router.get("/unsubscribe/{token}")
def unsubscribe_via_token(token: str, db: Session = Depends(get_db)):
    from models import CampaignSend
    send = db.query(CampaignSend).filter(CampaignSend.tracking_token == token).first()
    if send:
        sub = db.query(Subscriber).filter(Subscriber.id == send.subscriber_id).first()
        if sub:
            sub.is_active = False
            db.commit()
    return {"status": "unsubscribed", "message": "You have been unsubscribed successfully."}
