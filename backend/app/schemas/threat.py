from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict


class ThreatCategory(str, Enum):
    PHISHING = "Phishing"
    RANSOMWARE = "Ransomware"
    DATA_BREACH = "Data Breach"
    VULNERABILITY = "Vulnerability"
    THIRD_PARTY_RISK = "Third-Party Risk"
    CREDENTIAL_ATTACK = "Credential Attack"
    CLOUD_MISCONFIGURATION = "Cloud Misconfiguration"
    INSIDER_THREAT = "Insider Threat"
    DDOS = "DDoS"
    MALWARE = "Malware"


class ThreatStatus(str, Enum):
    OPEN = "Open"
    INVESTIGATING = "Investigating"
    MITIGATED = "Mitigated"
    CLOSED = "Closed"


class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


# --- Timeline Schemas ---

class TimelineEventBase(BaseModel):
    event_type: str = Field(..., examples=["STATUS_CHANGED"])
    description: str = Field(..., examples=["Threat status changed from Open to Investigating by SOC analyst."])


class TimelineEventCreate(TimelineEventBase):
    pass


class TimelineEventResponse(TimelineEventBase):
    id: str | int
    threat_id: str | int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Threat Schemas ---

class ThreatBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, examples=["Spear-phishing targeting Executive Financial Officers"])
    description: str = Field(..., min_length=5, examples=["High-fidelity email lures containing malicious macro attachments impersonating SEC filings."])
    category: ThreatCategory = Field(default=ThreatCategory.PHISHING)
    likelihood: int = Field(..., ge=1, le=5, description="Likelihood score from 1 (rare) to 5 (almost certain)", examples=[4])
    impact: int = Field(..., ge=1, le=5, description="Impact score from 1 (negligible) to 5 (catastrophic)", examples=[4])
    status: ThreatStatus = Field(default=ThreatStatus.OPEN)
    affected_asset: str = Field(..., min_length=2, max_length=255, examples=["c-suite-macbooks, exchange-hybrid-relay"])


class ThreatCreate(ThreatBase):
    pass


class ThreatUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=5)
    category: Optional[ThreatCategory] = None
    likelihood: Optional[int] = Field(None, ge=1, le=5)
    impact: Optional[int] = Field(None, ge=1, le=5)
    status: Optional[ThreatStatus] = None
    affected_asset: Optional[str] = Field(None, min_length=2, max_length=255)


class ThreatResponse(ThreatBase):
    id: str | int
    risk_score: int
    risk_level: RiskLevel
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedThreatsResponse(BaseModel):
    items: List[ThreatResponse]
    total: int
    skip: int
    limit: int
    page: Optional[int] = None


# --- Stats & Trends Schemas ---

class DailyScoreTrend(BaseModel):
    date: str = Field(..., examples=["2026-10-15"])
    avg_score: float = Field(..., examples=[12.4])
    threat_count: int = Field(..., examples=[3])
    critical_count: int = Field(..., examples=[1])


class ThreatStatsResponse(BaseModel):
    total_threats: int
    by_level: Dict[str, int]
    by_status: Dict[str, int]
    by_category: Dict[str, int]
    average_risk_score: float
    trend_30d: List[DailyScoreTrend]


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None
