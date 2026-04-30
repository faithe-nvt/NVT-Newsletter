from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean,
    Float, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    pending_qa = "pending_qa"
    approved = "approved"
    scheduled = "scheduled"
    sent = "sent"


class SubscriberSource(str, enum.Enum):
    csv = "csv"
    form = "form"
    manual = "manual"


class Subscriber(Base):
    __tablename__ = "subscribers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String)
    last_name = Column(String)
    company = Column(String)
    industry = Column(String, default="accounting")
    source = Column(SAEnum(SubscriberSource), default=SubscriberSource.manual)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    events = relationship("TrackingEvent", back_populates="subscriber")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    subject_a = Column(String, nullable=False)
    subject_b = Column(String)
    body_a = Column(Text, nullable=False)
    body_b = Column(Text)
    industry = Column(String, default="accounting")
    status = Column(SAEnum(CampaignStatus), default=CampaignStatus.draft)
    sources = Column(Text)           # JSON list of source URLs/titles
    angle = Column(String)           # e.g. "risk reduction", "time saving"
    style_rationale = Column(Text)   # why this writing style works
    qa_notes = Column(Text)          # QA reviewer notes
    campaign_rationale = Column(Text)# why this campaign works overall
    scheduled_at = Column(DateTime(timezone=True))
    sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    events = relationship("TrackingEvent", back_populates="campaign")


class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    subscriber_id = Column(Integer, ForeignKey("subscribers.id"))
    variant = Column(String, default="a")      # "a" or "b"
    event_type = Column(String, nullable=False) # "open" or "click"
    url_clicked = Column(String)
    ip_address = Column(String)
    user_agent = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("Campaign", back_populates="events")
    subscriber = relationship("Subscriber", back_populates="events")


class CampaignSend(Base):
    __tablename__ = "campaign_sends"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    subscriber_id = Column(Integer, ForeignKey("subscribers.id"))
    variant = Column(String, default="a")
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    tracking_token = Column(String, unique=True, index=True)


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
