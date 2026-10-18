import logging
from typing import Optional, Tuple
from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db, SessionLocal
from app.core.mongo import get_mongo_db, check_mongo_connection
from app.repositories.base import ThreatRepository, TimelineRepository, BriefingCacheRepository
from app.repositories.sqlite_repo import SQLiteThreatRepository, SQLiteTimelineRepository, SQLiteBriefingCacheRepository
from app.repositories.mongo_repo import MongoThreatRepository, MongoTimelineRepository, MongoBriefingCacheRepository

logger = logging.getLogger(__name__)


def resolve_active_db_status() -> Tuple[str, bool, bool, Optional[str]]:
    """
    Evaluate which database backend should run:
    Returns (active_backend, is_reachable, is_fallback, error_detail).
    Never logs the connection string.
    """
    settings = get_settings()
    configured_backend = (settings.DB_BACKEND or "sqlite").strip().lower()

    if configured_backend == "mongo":
        reachable, err = check_mongo_connection()
        if reachable:
            return "mongo", True, False, None
        
        # MongoDB unreachable
        if settings.DB_FALLBACK:
            logger.warning("MongoDB connection failed; falling back to SQLite (DB_FALLBACK=True).")
            return "sqlite", True, True, err
        else:
            return "mongo", False, False, err

    return "sqlite", True, False, None


def get_active_backend_name() -> str:
    """Return 'mongo' or 'sqlite'."""
    active, _, _, _ = resolve_active_db_status()
    return active


def get_threat_repo(db: Session = Depends(get_db)) -> ThreatRepository:
    active_backend = get_active_backend_name()
    if active_backend == "mongo":
        return MongoThreatRepository(get_mongo_db())
    return SQLiteThreatRepository(db)


def get_timeline_repo(db: Session = Depends(get_db)) -> TimelineRepository:
    active_backend = get_active_backend_name()
    if active_backend == "mongo":
        return MongoTimelineRepository(get_mongo_db())
    return SQLiteTimelineRepository(db)


def get_briefing_repo() -> BriefingCacheRepository:
    active_backend = get_active_backend_name()
    if active_backend == "mongo":
        return MongoBriefingCacheRepository(get_mongo_db())
    return SQLiteBriefingCacheRepository()


def get_standalone_threat_repo() -> ThreatRepository:
    """Utility to retrieve active threat repo outside of FastAPI request lifecycle (e.g. startup/seeding)."""
    active_backend = get_active_backend_name()
    if active_backend == "mongo":
        return MongoThreatRepository(get_mongo_db())
    return SQLiteThreatRepository(SessionLocal())
