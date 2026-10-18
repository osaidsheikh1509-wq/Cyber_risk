from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class DatabaseHealth(BaseModel):
    backend: str = Field(..., examples=["sqlite", "mongo"])
    reachable: bool = Field(..., examples=[True])
    fallback: bool = Field(default=False)
    error: Optional[str] = None


class HealthCheckResponse(BaseModel):
    status: str = Field(..., examples=["healthy", "unhealthy"])
    app_name: str = Field(..., examples=["Cyber Risk Tracker API"])
    version: str = Field(..., examples=["1.0.0"])
    environment: str = Field(..., examples=["development"])
    database: Optional[DatabaseHealth] = None
    database_backend: Optional[str] = None


class RiskSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskStatus(str, Enum):
    OPEN = "open"
    IN_REVIEW = "in_review"
    MITIGATED = "mitigated"


class RiskCategory(str, Enum):
    NETWORK = "network"
    ENDPOINT = "endpoint"
    CLOUD = "cloud"
    IDENTITY = "identity"
    COMPLIANCE = "compliance"
    APPLICATION = "application"


class RiskItemBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, examples=["Unpatched CVE-2024-38077 on Domain Controller"])
    description: str = Field(..., min_length=5, max_length=1000, examples=["Remote code execution vulnerability detected in Windows Remote Desktop Gateway."])
    severity: RiskSeverity = Field(default=RiskSeverity.HIGH)
    category: RiskCategory = Field(default=RiskCategory.NETWORK)
    status: RiskStatus = Field(default=RiskStatus.OPEN)
    score: float = Field(..., ge=0.0, le=10.0, examples=[8.8])


class RiskItemCreate(RiskItemBase):
    pass


class RiskItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=5, max_length=1000)
    severity: Optional[RiskSeverity] = None
    category: Optional[RiskCategory] = None
    status: Optional[RiskStatus] = None
    score: Optional[float] = Field(None, ge=0.0, le=10.0)


class RiskItemResponse(RiskItemBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RiskStatsResponse(BaseModel):
    total_risks: int
    critical: int
    high: int
    medium: int
    low: int
    open_count: int
    mitigated_count: int
    average_score: float


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None
