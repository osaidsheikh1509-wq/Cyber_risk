from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base


class RiskItem(Base):
    __tablename__ = "risk_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=False)
    severity = Column(String(50), nullable=False)  # critical, high, medium, low
    category = Column(String(100), nullable=False)  # network, endpoint, cloud, identity, compliance
    status = Column(String(50), nullable=False, default="open")  # open, in_review, mitigated
    score = Column(Float, nullable=False, default=5.0)  # 0.0 - 10.0
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
