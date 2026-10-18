import logging
from typing import Optional, Tuple
from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from pymongo.database import Database
from pymongo.errors import PyMongoError, ConnectionFailure, ServerSelectionTimeoutError

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_mongo_client: Optional[MongoClient] = None
_mongo_db_override: Optional[Database] = None


def get_mongo_client(uri: Optional[str] = None, timeout_ms: int = 3000) -> MongoClient:
    """
    Get or create a singleton MongoClient instance.
    Never logs or exposes the connection string in logs.
    """
    global _mongo_client
    if _mongo_client is not None:
        return _mongo_client

    settings = get_settings()
    connection_uri = uri or settings.MONGODB_URI
    if not connection_uri:
        raise ValueError("MONGODB_URI is not configured in backend environment")

    # Connect with short timeout so failure is reported quickly
    _mongo_client = MongoClient(
        connection_uri,
        serverSelectionTimeoutMS=timeout_ms,
        connectTimeoutMS=timeout_ms,
        socketTimeoutMS=timeout_ms,
    )
    return _mongo_client


def set_mongo_db_override(db: Optional[Database]) -> None:
    """Allow injecting a mocked Database instance (e.g. mongomock) for testing."""
    global _mongo_db_override
    _mongo_db_override = db


def get_mongo_db(db_name: Optional[str] = None) -> Database:
    """Return the active MongoDB Database instance."""
    global _mongo_db_override
    if _mongo_db_override is not None:
        return _mongo_db_override

    settings = get_settings()
    target_db_name = db_name or settings.MONGODB_DB or "cyber_risk_tracker"
    client = get_mongo_client()
    return client[target_db_name]


def close_mongo_client() -> None:
    """Close the MongoDB connection pool cleanly."""
    global _mongo_client
    if _mongo_client is not None:
        try:
            _mongo_client.close()
        except Exception:
            pass
        _mongo_client = None


def check_mongo_connection(timeout_ms: int = 2500) -> Tuple[bool, Optional[str]]:
    """
    Ping MongoDB to verify reachability.
    Returns (is_reachable, error_message).
    Never logs or includes credentials in the returned error.
    """
    global _mongo_db_override
    if _mongo_db_override is not None:
        return True, None

    settings = get_settings()
    if not settings.MONGODB_URI:
        return False, "MONGODB_URI is not set"

    try:
        client = get_mongo_client(timeout_ms=timeout_ms)
        client.admin.command("ping")
        return True, None
    except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError, Exception) as exc:
        err_msg = f"MongoDB connection failed: {type(exc).__name__}"
        logger.warning(err_msg)
        return False, err_msg


def init_mongo_indexes(db: Database) -> None:
    """
    Create all required MongoDB indexes at startup:
      - threats: created_at, risk_level, status, category, risk_score, text(title, description)
      - timeline_events: (threat_id, timestamp), (threat_id, created_at)
      - briefings: unique index on (threat_id, lang)
    """
    try:
        # 1. Threats collection indexes
        threats_col = db["threats"]
        threats_col.create_index([("created_at", DESCENDING)], name="idx_threats_created_at")
        threats_col.create_index([("risk_level", ASCENDING)], name="idx_threats_risk_level")
        threats_col.create_index([("status", ASCENDING)], name="idx_threats_status")
        threats_col.create_index([("category", ASCENDING)], name="idx_threats_category")
        threats_col.create_index([("risk_score", DESCENDING)], name="idx_threats_risk_score")
        
        # Text index on title and description for search
        try:
            threats_col.create_index(
                [("title", TEXT), ("description", TEXT)],
                name="idx_threats_text_search",
                default_language="english",
            )
        except Exception as e:
            # mongomock might have limited text index support
            logger.debug("Text index creation note: %s", e)

        # 2. Timeline events collection indexes
        timeline_col = db["timeline_events"]
        timeline_col.create_index(
            [("threat_id", ASCENDING), ("timestamp", DESCENDING)],
            name="idx_timeline_threat_timestamp",
        )
        timeline_col.create_index(
            [("threat_id", ASCENDING), ("created_at", DESCENDING)],
            name="idx_timeline_threat_created_at",
        )

        # 3. Briefings cache collection unique index
        briefings_col = db["briefings"]
        briefings_col.create_index(
            [("threat_id", ASCENDING), ("lang", ASCENDING)],
            unique=True,
            name="idx_briefings_threat_lang_unique",
        )
        logger.info("MongoDB indexes verified/created successfully.")
    except Exception as exc:
        logger.warning("Failed to create some MongoDB indexes: %s", exc)
