from pydantic import BaseModel, Field


class ThreatBriefingResponse(BaseModel):
    """Response returned by POST /threats/{id}/briefing."""
    threat_id: str | int
    language_code: str
    original_english: str = Field(..., description="The standard 3-sentence English briefing.")
    briefing_text: str = Field(..., description="The translated briefing text spoken by the TTS model.")
    audio_base64: str = Field(..., description="Base64 encoded audio string (WAV format).")
    cached: bool = Field(default=False, description="True if returned from in-memory cache to save API credits.")
