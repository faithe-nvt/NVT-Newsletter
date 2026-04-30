"""
Open and click tracking via pixel image and redirect URLs.
"""
import uuid
import json
from sqlalchemy.orm import Session
from models import TrackingEvent, CampaignSend


def generate_token() -> str:
    return str(uuid.uuid4()).replace("-", "")


def record_open(db: Session, token: str, ip: str = None, user_agent: str = None) -> bool:
    send = db.query(CampaignSend).filter(CampaignSend.tracking_token == token).first()
    if not send:
        return False

    already_opened = db.query(TrackingEvent).filter(
        TrackingEvent.campaign_id == send.campaign_id,
        TrackingEvent.subscriber_id == send.subscriber_id,
        TrackingEvent.event_type == "open",
    ).first()

    if not already_opened:
        event = TrackingEvent(
            campaign_id=send.campaign_id,
            subscriber_id=send.subscriber_id,
            variant=send.variant,
            event_type="open",
            ip_address=ip,
            user_agent=user_agent,
        )
        db.add(event)
        db.commit()
    return True


def record_click(db: Session, token: str, url: str, ip: str = None, user_agent: str = None) -> str:
    """Records a click and returns the destination URL."""
    send = db.query(CampaignSend).filter(CampaignSend.tracking_token == token).first()
    if send:
        event = TrackingEvent(
            campaign_id=send.campaign_id,
            subscriber_id=send.subscriber_id,
            variant=send.variant,
            event_type="click",
            url_clicked=url,
            ip_address=ip,
            user_agent=user_agent,
        )
        db.add(event)
        db.commit()
    return url


def get_campaign_stats(db: Session, campaign_id: int) -> dict:
    from sqlalchemy import func
    from models import CampaignSend

    sends = db.query(func.count(CampaignSend.id)).filter(
        CampaignSend.campaign_id == campaign_id
    ).scalar() or 0

    opens = db.query(func.count(TrackingEvent.id)).filter(
        TrackingEvent.campaign_id == campaign_id,
        TrackingEvent.event_type == "open",
    ).scalar() or 0

    clicks = db.query(func.count(TrackingEvent.id)).filter(
        TrackingEvent.campaign_id == campaign_id,
        TrackingEvent.event_type == "click",
    ).scalar() or 0

    # Per variant
    stats = {"total_sent": sends, "opens": opens, "clicks": clicks}
    for variant in ["a", "b"]:
        v_sends = db.query(func.count(CampaignSend.id)).filter(
            CampaignSend.campaign_id == campaign_id,
            CampaignSend.variant == variant,
        ).scalar() or 0
        v_opens = db.query(func.count(TrackingEvent.id)).filter(
            TrackingEvent.campaign_id == campaign_id,
            TrackingEvent.variant == variant,
            TrackingEvent.event_type == "open",
        ).scalar() or 0
        v_clicks = db.query(func.count(TrackingEvent.id)).filter(
            TrackingEvent.campaign_id == campaign_id,
            TrackingEvent.variant == variant,
            TrackingEvent.event_type == "click",
        ).scalar() or 0
        stats[f"variant_{variant}"] = {
            "sent": v_sends,
            "opens": v_opens,
            "clicks": v_clicks,
            "open_rate": round(v_opens / v_sends * 100, 1) if v_sends else 0,
            "click_rate": round(v_clicks / v_sends * 100, 1) if v_sends else 0,
        }

    stats["open_rate"] = round(opens / sends * 100, 1) if sends else 0
    stats["click_rate"] = round(clicks / sends * 100, 1) if sends else 0
    return stats
