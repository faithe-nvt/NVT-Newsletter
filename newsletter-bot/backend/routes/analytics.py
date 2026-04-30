from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import List
import io

from database import get_db
from models import TrackingEvent, CampaignSend, Campaign, Subscriber
from services.tracker import record_open, record_click, get_campaign_stats

router = APIRouter(tags=["analytics"])

# 1x1 transparent GIF
TRACKING_PIXEL = bytes([
    0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,0x80,0x00,0x00,
    0xFF,0xFF,0xFF,0x00,0x00,0x00,0x21,0xF9,0x04,0x00,0x00,0x00,0x00,
    0x00,0x2C,0x00,0x00,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,
    0x44,0x01,0x00,0x3B
])


@router.get("/track/open/{token}")
def track_open(token: str, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    record_open(db, token, ip, ua)
    return Response(content=TRACKING_PIXEL, media_type="image/gif")


@router.get("/track/click/{token}")
def track_click(token: str, url: str, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    destination = record_click(db, token, url, ip, ua)
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=destination)


@router.get("/analytics/overview")
def analytics_overview(db: Session = Depends(get_db)):
    total_campaigns = db.query(func.count(Campaign.id)).scalar() or 0
    sent_campaigns = db.query(func.count(Campaign.id)).filter(
        Campaign.status == "sent"
    ).scalar() or 0
    total_subscribers = db.query(func.count(Subscriber.id)).filter(
        Subscriber.is_active == True
    ).scalar() or 0
    total_sends = db.query(func.count(CampaignSend.id)).scalar() or 0
    total_opens = db.query(func.count(TrackingEvent.id)).filter(
        TrackingEvent.event_type == "open"
    ).scalar() or 0
    total_clicks = db.query(func.count(TrackingEvent.id)).filter(
        TrackingEvent.event_type == "click"
    ).scalar() or 0

    return {
        "total_campaigns": total_campaigns,
        "sent_campaigns": sent_campaigns,
        "total_subscribers": total_subscribers,
        "total_sends": total_sends,
        "total_opens": total_opens,
        "total_clicks": total_clicks,
        "avg_open_rate": round(total_opens / total_sends * 100, 1) if total_sends else 0,
        "avg_click_rate": round(total_clicks / total_sends * 100, 1) if total_sends else 0,
    }


@router.get("/analytics/campaigns")
def campaign_analytics(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).filter(Campaign.status == "sent").order_by(Campaign.sent_at.desc()).all()
    results = []
    for c in campaigns:
        stats = get_campaign_stats(db, c.id)
        results.append({
            "id": c.id,
            "title": c.title,
            "subject_a": c.subject_a,
            "subject_b": c.subject_b,
            "sent_at": str(c.sent_at) if c.sent_at else None,
            "angle": c.angle,
            "stats": stats,
        })
    return results


@router.get("/analytics/events-timeline")
def events_timeline(days: int = 30, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)
    events = (
        db.query(
            func.date(TrackingEvent.created_at).label("date"),
            TrackingEvent.event_type,
            func.count(TrackingEvent.id).label("count"),
        )
        .filter(TrackingEvent.created_at >= cutoff)
        .group_by(func.date(TrackingEvent.created_at), TrackingEvent.event_type)
        .order_by(func.date(TrackingEvent.created_at))
        .all()
    )

    timeline = {}
    for row in events:
        date_str = str(row.date)
        if date_str not in timeline:
            timeline[date_str] = {"date": date_str, "opens": 0, "clicks": 0}
        timeline[date_str][row.event_type + "s"] = row.count

    return list(timeline.values())


@router.get("/analytics/subscriber-growth")
def subscriber_growth(days: int = 90, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(days=days)
    growth = (
        db.query(
            func.date(Subscriber.created_at).label("date"),
            func.count(Subscriber.id).label("count"),
        )
        .filter(Subscriber.created_at >= cutoff)
        .group_by(func.date(Subscriber.created_at))
        .order_by(func.date(Subscriber.created_at))
        .all()
    )
    return [{"date": str(r.date), "new_subscribers": r.count} for r in growth]


@router.get("/analytics/ab-results")
def ab_results(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).filter(Campaign.status == "sent").all()
    results = []
    for c in campaigns:
        stats = get_campaign_stats(db, c.id)
        va = stats.get("variant_a", {})
        vb = stats.get("variant_b", {})
        if va.get("sent", 0) == 0 and vb.get("sent", 0) == 0:
            continue
        winner = None
        if va.get("open_rate", 0) > vb.get("open_rate", 0):
            winner = "a"
        elif vb.get("open_rate", 0) > va.get("open_rate", 0):
            winner = "b"
        results.append({
            "campaign_id": c.id,
            "title": c.title,
            "variant_a": {"subject": c.subject_a, **va},
            "variant_b": {"subject": c.subject_b or c.subject_a, **vb},
            "winner": winner,
        })
    return results
