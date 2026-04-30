from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json
import os

from database import get_db
from models import Campaign, CampaignStatus, CampaignSend, Subscriber
from services.news_fetcher import get_industry_news
from services.content_generator import generate_newsletter_variants, render_email_html
from services.email_sender import send_campaign_batch
from services.tracker import generate_token, get_campaign_stats

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    subject_a: Optional[str] = None
    subject_b: Optional[str] = None
    body_a: Optional[str] = None
    body_b: Optional[str] = None
    qa_notes: Optional[str] = None
    status: Optional[str] = None
    scheduled_at: Optional[str] = None


@router.get("/")
def list_campaigns(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for c in campaigns:
        stats = get_campaign_stats(db, c.id)
        result.append({
            "id": c.id,
            "title": c.title,
            "subject_a": c.subject_a,
            "subject_b": c.subject_b,
            "industry": c.industry,
            "status": c.status,
            "angle": c.angle,
            "scheduled_at": str(c.scheduled_at) if c.scheduled_at else None,
            "sent_at": str(c.sent_at) if c.sent_at else None,
            "created_at": str(c.created_at),
            "stats": stats,
        })
    return result


@router.get("/{campaign_id}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    sources = []
    try:
        sources = json.loads(c.sources or "[]")
    except Exception:
        pass

    stats = get_campaign_stats(db, c.id)

    return {
        "id": c.id,
        "title": c.title,
        "subject_a": c.subject_a,
        "subject_b": c.subject_b,
        "body_a": c.body_a,
        "body_b": c.body_b,
        "industry": c.industry,
        "status": c.status,
        "angle": c.angle,
        "style_rationale": c.style_rationale,
        "qa_notes": c.qa_notes,
        "campaign_rationale": c.campaign_rationale,
        "sources": sources,
        "scheduled_at": str(c.scheduled_at) if c.scheduled_at else None,
        "sent_at": str(c.sent_at) if c.sent_at else None,
        "created_at": str(c.created_at),
        "stats": stats,
    }


@router.post("/generate")
async def generate_campaign(
    industry: str = "accounting",
    db: Session = Depends(get_db),
):
    """Fetches news and generates A/B newsletter variants via Claude."""
    articles = await get_industry_news(industry=industry, max_results=8)
    if not articles:
        raise HTTPException(status_code=502, detail="Could not fetch news articles. Check your RSS or NewsAPI.")

    variant_a, variant_b, rationale = await generate_newsletter_variants(articles, industry)

    # Build full HTML body from structured variant data
    body_a = _variant_to_text(variant_a)
    body_b = _variant_to_text(variant_b)

    campaign = Campaign(
        title=f"[DRAFT] {variant_a.get('subject_line', 'Newsletter')} — {datetime.utcnow().strftime('%b %Y')}",
        subject_a=variant_a.get("subject_line", ""),
        subject_b=variant_b.get("subject_line", ""),
        body_a=json.dumps(variant_a),
        body_b=json.dumps(variant_b),
        industry=industry,
        status=CampaignStatus.pending_qa,
        sources=json.dumps(variant_a.get("sources_used", [])),
        angle=variant_a.get("angle_used", ""),
        style_rationale=variant_a.get("style_rationale", ""),
        campaign_rationale=rationale,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    return {
        "campaign_id": campaign.id,
        "variant_a": variant_a,
        "variant_b": variant_b,
        "campaign_rationale": rationale,
        "articles_used": len(articles),
    }


@router.patch("/{campaign_id}")
def update_campaign(campaign_id: int, data: CampaignUpdate, db: Session = Depends(get_db)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    for field, value in data.dict(exclude_none=True).items():
        if field == "status":
            c.status = CampaignStatus(value)
        elif field == "scheduled_at" and value:
            c.scheduled_at = datetime.fromisoformat(value)
        else:
            setattr(c, field, value)

    db.commit()
    return {"status": "updated"}


@router.post("/{campaign_id}/approve")
def approve_campaign(campaign_id: int, db: Session = Depends(get_db)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c.status = CampaignStatus.approved
    db.commit()
    return {"status": "approved"}


@router.post("/{campaign_id}/send")
async def send_campaign(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status not in (CampaignStatus.approved, CampaignStatus.scheduled):
        raise HTTPException(status_code=400, detail="Campaign must be approved before sending")

    subscribers = db.query(Subscriber).filter(Subscriber.is_active == True).all()
    if not subscribers:
        raise HTTPException(status_code=400, detail="No active subscribers")

    background_tasks.add_task(_do_send, campaign_id, subscribers, db)
    return {"status": "sending", "recipient_count": len(subscribers)}


async def _do_send(campaign_id: int, subscribers: list, db: Session):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        return

    try:
        variant_a_data = json.loads(c.body_a)
        variant_b_data = json.loads(c.body_b) if c.body_b else variant_a_data
    except Exception:
        variant_a_data = {"subject_line": c.subject_a}
        variant_b_data = {"subject_line": c.subject_b or c.subject_a}

    recipients = []
    for i, sub in enumerate(subscribers):
        variant = "a" if i % 2 == 0 else "b"
        token = generate_token()
        variant_data = variant_a_data if variant == "a" else variant_b_data
        subject = c.subject_a if variant == "a" else (c.subject_b or c.subject_a)

        html = render_email_html(variant_data, c.id, sub.id, token, BASE_URL)

        send_record = CampaignSend(
            campaign_id=c.id,
            subscriber_id=sub.id,
            variant=variant,
            tracking_token=token,
        )
        db.add(send_record)

        recipients.append({
            "email": sub.email,
            "subject": subject,
            "html_body": html,
            "token": token,
        })

    db.commit()

    await send_campaign_batch(recipients)

    c.status = CampaignStatus.sent
    c.sent_at = datetime.utcnow()
    db.commit()


def _variant_to_text(v: dict) -> str:
    """Converts structured variant JSON to readable text for storage/preview."""
    parts = [
        v.get("hook", ""),
        "",
        v.get("insight_block", ""),
        "",
        f"— {v.get('mid_cta', '')}",
        "",
        "Key Takeaways:",
        *[f"• {t}" for t in v.get("practical_takeaway", [])],
        "",
        v.get("closing_thought", ""),
        "",
        v.get("end_cta", ""),
    ]
    return "\n".join(parts)


@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status == CampaignStatus.sent:
        raise HTTPException(status_code=400, detail="Cannot delete a sent campaign")
    db.delete(c)
    db.commit()
    return {"status": "deleted"}
