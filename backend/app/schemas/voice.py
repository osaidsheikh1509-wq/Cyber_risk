from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.ai import AIAssessResponse


class VoiceReportResponse(BaseModel):
    """Response returned by POST /voice/report."""
    transcript_original: str = Field(
        ...,
        description="Transcribed text in the original spoken language.",
        examples=["हमारे मुख्य डेटाबेस सर्वर पर रैनसमवेयर का हमला हुआ है।"],
    )
    transcript_english: str = Field(
        ...,
        description="Translated English text of the voice report used for threat intelligence evaluation.",
        examples=["Ransomware attack detected on our primary database server."],
    )
    language_code: str = Field(
        default="unknown",
        description="Detected or provided spoken language code (e.g. hi-IN, en-IN, kn-IN).",
    )
    assessment: AIAssessResponse = Field(
        ...,
        description="AI threat risk assessment derived from the transcribed voice report.",
    )
