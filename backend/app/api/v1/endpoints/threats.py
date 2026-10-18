import base64
import logging
from typing import List, Optional, Union
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core.risk_calculator import calculate_risk, get_response_timeline_hours
from app.repositories import (
    ThreatRepository,
    TimelineRepository,
    BriefingCacheRepository,
    get_threat_repo,
    get_timeline_repo,
    get_briefing_repo,
)
from app.schemas.briefing import ThreatBriefingResponse
from app.schemas.threat import (
    ThreatCreate,
    ThreatUpdate,
    ThreatResponse,
    PaginatedThreatsResponse,
    TimelineEventCreate,
    TimelineEventResponse,
    ThreatCategory,
    ThreatStatus,
    RiskLevel,
    MessageResponse,
)
from app.services.sarvam import SarvamClient

logger = logging.getLogger(__name__)
router = APIRouter()

SUPPORTED_BRIEFING_LANGUAGES = {
    "en-IN",
    "hi-IN",
    "bn-IN",
    "ta-IN",
    "te-IN",
    "gu-IN",
    "kn-IN",
    "ml-IN",
    "mr-IN",
    "pa-IN",
    "od-IN",
}


@router.get(
    "",
    response_model=Union[PaginatedThreatsResponse, List[ThreatResponse]],
    summary="List, filter, paginate, sort, and search threats",
)
def list_threats(
    response: Response,
    category: Optional[ThreatCategory] = Query(None, description="Filter by threat category"),
    risk_level: Optional[RiskLevel] = Query(None, description="Filter by risk tier (Low, Medium, High, Critical)"),
    status: Optional[ThreatStatus] = Query(None, description="Filter by threat status"),
    affected_asset: Optional[str] = Query(None, description="Filter by affected asset substring"),
    min_score: Optional[int] = Query(None, ge=1, le=25, description="Filter by minimum risk score"),
    max_score: Optional[int] = Query(None, ge=1, le=25, description="Filter by maximum risk score"),
    search: Optional[str] = Query(None, description="Search term in title or description"),
    q: Optional[str] = Query(None, description="Text search query (alias for search)"),
    sort_by: Optional[str] = Query("highest_risk", description="Sort order: 'newest', 'highest_risk', 'lowest_risk', 'oldest'"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    page: Optional[int] = Query(None, ge=1, description="Page number (1-indexed, computes skip = (page - 1) * limit)"),
    paginate: bool = Query(False, description="If True, returns PaginatedThreatsResponse dict; if False, returns list with X-Total-Count header"),
    threat_repo: ThreatRepository = Depends(get_threat_repo),
) -> Union[PaginatedThreatsResponse, List[ThreatResponse]]:
    """Retrieve threats with optional multi-attribute filtering, sorting, pagination, and text search."""
    actual_skip = (page - 1) * limit if page is not None else skip
    actual_page = page if page is not None else (actual_skip // limit + 1)
    search_query = (q or search or "").strip() or None

    items_dict, total_count = threat_repo.list(
        category=category.value if category else None,
        risk_level=risk_level.value if risk_level else None,
        status=status.value if status else None,
        affected_asset=affected_asset,
        min_score=min_score,
        max_score=max_score,
        search=search_query,
        q=search_query,
        sort_by=sort_by,
        skip=actual_skip,
        limit=limit,
    )

    # Expose total count via headers for standard list requests
    response.headers["X-Total-Count"] = str(total_count)
    response.headers["Total-Count"] = str(total_count)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count, Total-Count"

    threat_models = [ThreatResponse(**t) for t in items_dict]

    if paginate:
        return PaginatedThreatsResponse(
            items=threat_models,
            total=total_count,
            skip=actual_skip,
            limit=limit,
            page=actual_page,
        )

    return threat_models


@router.post("", response_model=ThreatResponse, status_code=status.HTTP_201_CREATED, summary="Create new threat")
def create_threat(
    threat_in: ThreatCreate,
    threat_repo: ThreatRepository = Depends(get_threat_repo),
    timeline_repo: TimelineRepository = Depends(get_timeline_repo),
) -> ThreatResponse:
    """Register a new cybersecurity threat and automatically compute risk score & level."""
    score, level = calculate_risk(threat_in.likelihood, threat_in.impact)

    created_threat = threat_repo.create({
        "title": threat_in.title,
        "description": threat_in.description,
        "category": threat_in.category.value,
        "likelihood": threat_in.likelihood,
        "impact": threat_in.impact,
        "status": threat_in.status.value,
        "affected_asset": threat_in.affected_asset,
    })

    # Automatically generate initial timeline event
    timeline_repo.create(
        threat_id=created_threat["id"],
        event_type="CREATED",
        description=f"Threat registered with score {score} ({level} Risk). Status: {created_threat['status']}.",
    )

    return ThreatResponse(**created_threat)


@router.get("/{threat_id}", response_model=ThreatResponse, summary="Get single threat")
def get_threat(
    threat_id: str,
    threat_repo: ThreatRepository = Depends(get_threat_repo),
) -> ThreatResponse:
    """Retrieve details for a specific threat by ID."""
    threat = threat_repo.get_by_id(threat_id)
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat with id {threat_id} not found")
    return ThreatResponse(**threat)


def _apply_threat_update(
    threat_id: str,
    threat_in: ThreatUpdate,
    threat_repo: ThreatRepository,
    timeline_repo: TimelineRepository,
    briefing_repo: BriefingCacheRepository,
) -> ThreatResponse:
    existing = threat_repo.get_by_id(threat_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Threat with id {threat_id} not found")

    update_data = threat_in.model_dump(exclude_unset=True)
    if not update_data:
        return ThreatResponse(**existing)

    old_status = existing["status"]
    old_score = existing["risk_score"]
    old_level = existing["risk_level"]

    # Convert enum values to string if present
    for k, v in list(update_data.items()):
        if hasattr(v, "value"):
            update_data[k] = v.value

    updated = threat_repo.update(threat_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Threat with id {threat_id} not found")

    # Create timeline events for notable audit changes
    if "status" in update_data and updated["status"] != old_status:
        timeline_repo.create(
            threat_id=threat_id,
            event_type="STATUS_CHANGED",
            description=f"Status transitioned from '{old_status}' to '{updated['status']}'.",
        )

    if (
        ("likelihood" in update_data or "impact" in update_data)
        and (updated["risk_score"] != old_score or updated["risk_level"] != old_level)
    ):
        timeline_repo.create(
            threat_id=threat_id,
            event_type="ASSESSMENT_UPDATED",
            description=(
                f"Risk score updated from {old_score} ({old_level}) to "
                f"{updated['risk_score']} ({updated['risk_level']}) "
                f"[L:{updated['likelihood']}, I:{updated['impact']}]."
            ),
        )

    # Invalidate cached multilingual briefings when threat changes
    briefing_repo.invalidate_threat(threat_id)
    return ThreatResponse(**updated)


@router.patch("/{threat_id}", response_model=ThreatResponse, summary="Partially update threat")
def patch_threat(
    threat_id: str,
    threat_in: ThreatUpdate,
    threat_repo: ThreatRepository = Depends(get_threat_repo),
    timeline_repo: TimelineRepository = Depends(get_timeline_repo),
    briefing_repo: BriefingCacheRepository = Depends(get_briefing_repo),
) -> ThreatResponse:
    """Partially update threat fields and record timeline changes."""
    return _apply_threat_update(threat_id, threat_in, threat_repo, timeline_repo, briefing_repo)


@router.put("/{threat_id}", response_model=ThreatResponse, summary="Update threat")
def put_threat(
    threat_id: str,
    threat_in: ThreatUpdate,
    threat_repo: ThreatRepository = Depends(get_threat_repo),
    timeline_repo: TimelineRepository = Depends(get_timeline_repo),
    briefing_repo: BriefingCacheRepository = Depends(get_briefing_repo),
) -> ThreatResponse:
    """Update threat fields and record timeline changes."""
    return _apply_threat_update(threat_id, threat_in, threat_repo, timeline_repo, briefing_repo)


@router.delete("/{threat_id}", response_model=MessageResponse, summary="Delete threat")
def delete_threat(
    threat_id: str,
    threat_repo: ThreatRepository = Depends(get_threat_repo),
    timeline_repo: TimelineRepository = Depends(get_timeline_repo),
    briefing_repo: BriefingCacheRepository = Depends(get_briefing_repo),
) -> MessageResponse:
    """Delete a threat and all associated timeline events and cached briefings."""
    existing = threat_repo.get_by_id(threat_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Threat with id {threat_id} not found")

    briefing_repo.invalidate_threat(threat_id)
    timeline_repo.delete_by_threat(threat_id)
    threat_repo.delete(threat_id)

    return MessageResponse(message=f"Threat {threat_id} successfully deleted")


@router.get("/{threat_id}/timeline", response_model=List[TimelineEventResponse], summary="Get threat timeline events")
def get_threat_timeline(
    threat_id: str,
    threat_repo: ThreatRepository = Depends(get_threat_repo),
    timeline_repo: TimelineRepository = Depends(get_timeline_repo),
) -> List[TimelineEventResponse]:
    """Retrieve chronological audit timeline events for a given threat."""
    existing = threat_repo.get_by_id(threat_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Threat with id {threat_id} not found")

    events = timeline_repo.list_by_threat(threat_id)
    return [TimelineEventResponse(**e) for e in events]


@router.post(
    "/{threat_id}/timeline",
    response_model=TimelineEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add event to threat timeline",
)
def add_threat_timeline_event(
    threat_id: str,
    event_in: TimelineEventCreate,
    threat_repo: ThreatRepository = Depends(get_threat_repo),
    timeline_repo: TimelineRepository = Depends(get_timeline_repo),
) -> TimelineEventResponse:
    """Append a custom audit note or timeline entry to a threat."""
    existing = threat_repo.get_by_id(threat_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Threat with id {threat_id} not found")

    created_event = timeline_repo.create(
        threat_id=existing["id"],
        event_type=event_in.event_type,
        description=event_in.description,
    )
    return TimelineEventResponse(**created_event)


@router.post(
    "/{threat_id}/briefing",
    response_model=ThreatBriefingResponse,
    summary="Generate or retrieve cached multilingual audio threat briefing",
)
def get_threat_briefing(
    threat_id: str,
    lang: str = Query("en-IN", description="Target language code (e.g. 'en-IN', 'hi-IN', 'kn-IN', 'ta-IN')"),
    bypass_cache: bool = Query(False, description="Bypass cache and force regenerate with Sarvam AI"),
    threat_repo: ThreatRepository = Depends(get_threat_repo),
    briefing_repo: BriefingCacheRepository = Depends(get_briefing_repo),
) -> ThreatBriefingResponse:
    """
    Generate or retrieve a cached multilingual audio briefing for a threat:
    1. Checks cache to save API credits on repeated requests (unless bypass_cache=True).
    2. Verifies that SARVAM_API_KEY is configured.
    3. Builds standardized 3-sentence threat intelligence briefing.
    4. Translates via Sarvam Translate if target language is not English.
    5. Synthesizes spoken audio using Sarvam TTS.
    6. Stores in briefing cache repository.
    """
    db_threat = threat_repo.get_by_id(threat_id)
    if not db_threat:
        raise HTTPException(status_code=404, detail=f"Threat with id {threat_id} not found")

    target_lang = lang.strip()
    if target_lang not in SUPPORTED_BRIEFING_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Language '{target_lang}' is not supported by Sarvam AI. Supported languages: {', '.join(sorted(SUPPORTED_BRIEFING_LANGUAGES))}",
        )

    # 1. Check Cache
    if not bypass_cache:
        cached = briefing_repo.get(threat_id, target_lang)
        if cached:
            try:
                audio_byte_len = len(base64.b64decode(cached["audio_base64"]))
            except Exception:
                audio_byte_len = 0
            logger.info(
                "Threat briefing [threat_id=%s, lang=%s]: CACHE HIT (audio_bytes=%d)",
                threat_id,
                target_lang,
                audio_byte_len,
            )
            return ThreatBriefingResponse(
                threat_id=cached["threat_id"],
                language_code=cached["language_code"],
                original_english=cached["original_english"],
                briefing_text=cached["briefing_text"],
                audio_base64=cached["audio_base64"],
                cached=True,
            )

    # 2. Cache Miss or Bypass -> Call Sarvam AI
    sarvam = SarvamClient()
    logger.info(
        "Threat briefing [threat_id=%s, lang=%s]: SARVAM CALL (bypass_cache=%s, api_key_loaded=%s)",
        threat_id,
        target_lang,
        bypass_cache,
        sarvam.has_api_key,
    )

    if not sarvam.has_api_key:
        logger.error(
            "Threat briefing [threat_id=%s, lang=%s]: SARVAM_API_KEY is not configured",
            threat_id,
            target_lang,
        )
        raise HTTPException(
            status_code=503,
            detail="SARVAM_API_KEY is not configured in backend environment. Please set SARVAM_API_KEY in backend/.env.",
        )

    sla_hours = get_response_timeline_hours(db_threat["risk_level"])
    sentence1 = f"Security briefing for threat alert {db_threat['title']}, classified as a {db_threat['category']} event targeting {db_threat['affected_asset']}."
    sentence2 = f"The automated assessment assigns a {db_threat['risk_level']} risk score of {db_threat['risk_score']} out of 25 with likelihood {db_threat['likelihood']} and impact {db_threat['impact']}, currently in {db_threat['status']} state."
    sentence3 = f"Response protocol requires containment actions within {sla_hours} hours to prevent lateral propagation and asset compromise."
    original_english = f"{sentence1} {sentence2} {sentence3}"

    briefing_text = original_english

    # Translate if target is not English
    if target_lang != "en-IN":
        try:
            trans_res = sarvam.translate(
                text=original_english,
                source="en-IN",
                target=target_lang,
                mode="formal",
                model="mayura:v1",
            )
            candidate = trans_res.get("translated_text", "").strip()
            if not candidate:
                raise ValueError("Sarvam Translate returned empty translated text")
            briefing_text = candidate
            logger.info(
                "Threat briefing [threat_id=%s, lang=%s]: Sarvam Translate SUCCESS",
                threat_id,
                target_lang,
            )
        except Exception as exc:
            err_status = getattr(exc, "status_code", 502)
            logger.error("Threat briefing [threat_id=%s, lang=%s]: Sarvam Translate FAILED", threat_id, target_lang)
            raise HTTPException(
                status_code=err_status if isinstance(err_status, int) and 400 <= err_status < 600 else 502,
                detail=f"Sarvam Translate failed for {target_lang}: {str(exc)}",
            ) from exc

    # Synthesize audio with Sarvam TTS
    try:
        tts_res = sarvam.synthesize(
            text=briefing_text,
            language=target_lang,
            speaker="shubh",
            model="bulbul:v3",
        )
        audios = tts_res.get("audios", [])
        if not audios or not audios[0]:
            raise ValueError("Sarvam TTS returned empty audio payload")

        audio_base64 = audios[0]
        decoded_bytes = base64.b64decode(audio_base64)
        audio_byte_len = len(decoded_bytes)
        if audio_byte_len <= 100:
            raise ValueError(f"Sarvam TTS audio is too small ({audio_byte_len} bytes)")

        logger.info("Threat briefing [threat_id=%s, lang=%s]: Sarvam TTS SUCCESS (%d bytes)", threat_id, target_lang, audio_byte_len)
    except Exception as exc:
        err_status = getattr(exc, "status_code", 502)
        logger.error("Threat briefing [threat_id=%s, lang=%s]: Sarvam TTS FAILED", threat_id, target_lang)
        raise HTTPException(
            status_code=err_status if isinstance(err_status, int) and 400 <= err_status < 600 else 502,
            detail=f"Sarvam TTS failed for {target_lang}: {str(exc)}",
        ) from exc

    response_data = {
        "threat_id": db_threat["id"],
        "language_code": target_lang,
        "original_english": original_english,
        "briefing_text": briefing_text,
        "audio_base64": audio_base64,
        "cached": False,
    }

    # Save to briefing cache repository
    briefing_repo.set(db_threat["id"], target_lang, response_data)
    return ThreatBriefingResponse(**response_data)
