from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Threat(Base):
    __tablename__ = "threats"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, index=True)
    likelihood = Column(Integer, nullable=False)  # 1-5
    impact = Column(Integer, nullable=False)      # 1-5
    risk_score = Column(Integer, nullable=False, index=True)  # likelihood * impact (1-25)
    risk_level = Column(String(20), nullable=False, index=True)  # Low, Medium, High, Critical
    status = Column(String(30), nullable=False, default="Open", index=True)  # Open, Investigating, Mitigated, Closed
    affected_asset = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Cascading relation to timeline events
    timeline_events = relationship(
        "TimelineEvent",
        back_populates="threat",
        cascade="all, delete-orphan",
        order_by="TimelineEvent.created_at.desc()",
    )


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    threat_id = Column(Integer, ForeignKey("threats.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # CREATED, STATUS_CHANGED, RISK_UPDATED, NOTE
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    threat = relationship("Threat", back_populates="timeline_events")
