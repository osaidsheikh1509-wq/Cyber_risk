from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.threat import ThreatCategory, RiskLevel


class AIAssessRequest(BaseModel):
    event_text: str = Field(
        ...,
        min_length=3,
        description="Raw incident description, alert log, or security event text to assess.",
        examples=["Multiple unauthorized SSH brute-force attempts detected originating from malicious IP 198.51.100.4 against production bastion."],
    )


class AIAssessmentRaw(BaseModel):
    """Schema used to validate raw JSON output produced by the LLM."""
    category: ThreatCategory
    likelihood: int = Field(..., ge=1, le=5)
    impact: int = Field(..., ge=1, le=5)
    reasoning: str = Field(..., min_length=5)
    recommended_actions: List[str] = Field(..., min_length=1, max_length=5)


class AIAssessResponse(BaseModel):
    category: ThreatCategory
    likelihood: int = Field(..., ge=1, le=5)
    impact: int = Field(..., ge=1, le=5)
    risk_score: int = Field(..., ge=1, le=25)
    risk_level: RiskLevel
    response_timeline_hours: int = Field(..., description="Response SLA target in hours (Critical: 4, High: 24, Medium: 72, Low: 168)")
    reasoning: str
    recommended_actions: List[str] = Field(..., description="Top 3 recommended mitigation actions")
    fallback: bool = Field(default=False, description="True if fallback to mock heuristics occurred")
    backend_used: str = Field(..., description="Name of the model backend that produced the assessment")
