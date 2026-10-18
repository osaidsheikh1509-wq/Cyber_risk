from fastapi import APIRouter, Response, status
from app.core.config import get_settings
from app.schemas.risk import HealthCheckResponse, DatabaseHealth
from app.repositories.dependencies import resolve_active_db_status

router = APIRouter()
settings = get_settings()


@router.get("/health", response_model=HealthCheckResponse, summary="Service Health Check")
def get_health(response: Response) -> HealthCheckResponse:
    """
    Return current server and service health status, reporting which database
    is active, whether it's reachable, fallback status, and sanitized error if unreachable.
    Never exposes credentials or connection strings.
    """
    active_backend, reachable, is_fallback, err_detail = resolve_active_db_status()

    # If database is unreachable and didn't fall back, set status to unhealthy and 503
    overall_status = "healthy" if reachable else "unhealthy"
    if not reachable:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    db_health = DatabaseHealth(
        backend=active_backend,
        reachable=reachable,
        fallback=is_fallback,
        error=err_detail,
    )

    return HealthCheckResponse(
        status=overall_status,
        app_name=settings.APP_NAME,
        version="1.0.0",
        environment=settings.APP_ENV,
        database=db_health,
        database_backend=active_backend,
    )
