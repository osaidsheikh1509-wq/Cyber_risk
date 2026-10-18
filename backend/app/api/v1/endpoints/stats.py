from fastapi import APIRouter, Depends
from app.repositories import ThreatRepository, get_threat_repo
from app.schemas.threat import ThreatStatsResponse

router = APIRouter()


@router.get("/stats", response_model=ThreatStatsResponse, summary="Get threat metrics and 30-day trend")
def get_threat_stats(
    threat_repo: ThreatRepository = Depends(get_threat_repo),
) -> ThreatStatsResponse:
    """Return aggregated threat counts by level, status, category, and 30-day score trend."""
    stats_data = threat_repo.get_stats()
    return ThreatStatsResponse(**stats_data)
