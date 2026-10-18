from fastapi import APIRouter, HTTPException, status
from app.core.risk_calculator import calculate_risk, get_response_timeline_hours
from app.schemas.ai import AIAssessRequest, AIAssessResponse
from app.services.risk_model import get_risk_model_client

router = APIRouter(prefix="", tags=["AI Threat Assessment"])


@router.post("/assess", response_model=AIAssessResponse, summary="Analyze a cybersecurity event with AI")
def assess_security_event(payload: AIAssessRequest) -> AIAssessResponse:
    """
    Analyze raw security event text, alert log, or incident description using the configured
    RiskModelClient backend (mock, sarvam, or ollama).

    The endpoint:
    1. Evaluates category, likelihood (1-5), and impact (1-5).
    2. Recomputes risk_score and risk_level strictly in the backend.
    3. Calculates response_timeline_hours (Low: 168h, Medium: 72h, High: 24h, Critical: 4h).
    4. Generates concise reasoning and exactly 3 prioritized recommended mitigation actions.
    5. Falls back seamlessly to mock heuristics if the upstream model fails, returning fallback=True.
    """
    event_text = payload.event_text.strip()
    if not event_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="event_text cannot be empty",
        )

    client = get_risk_model_client()
    result = client.assess(event_text)

    # Strictly recompute risk_score and risk_level in backend
    risk_score, risk_level = calculate_risk(result.likelihood, result.impact)
    response_timeline_hours = get_response_timeline_hours(risk_level)

    return AIAssessResponse(
        category=result.category,
        likelihood=result.likelihood,
        impact=result.impact,
        risk_score=risk_score,
        risk_level=risk_level,  # type: ignore[arg-type]
        response_timeline_hours=response_timeline_hours,
        reasoning=result.reasoning,
        recommended_actions=result.recommended_actions[:3],
        fallback=result.fallback,
        backend_used=result.backend_used,
    )
