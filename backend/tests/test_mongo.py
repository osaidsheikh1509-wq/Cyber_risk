import re
import pytest
import mongomock
from bson import ObjectId
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import get_settings, sanitize_mongodb_uri
from app.core.mongo import (
    set_mongo_db_override,
    init_mongo_indexes,
    check_mongo_connection,
)
from app.repositories import (
    MongoThreatRepository,
    MongoTimelineRepository,
    MongoBriefingCacheRepository,
    resolve_active_db_status,
)


@pytest.fixture
def mock_mongo_db():
    """Create an isolated in-memory Mongo database using mongomock."""
    client = mongomock.MongoClient()
    db = client["test_cyber_risk_tracker"]
    init_mongo_indexes(db)
    yield db
    client.close()


def test_sanitize_mongodb_uri_never_leaks_password():
    """Ensure credentials in MongoDB URIs are stripped completely."""
    raw_uri = "mongodb+srv://user_alice:SuperSecretPassword123@cluster0.abc.mongodb.net/?retryWrites=true"
    sanitized = sanitize_mongodb_uri(raw_uri)
    assert "SuperSecretPassword123" not in sanitized
    assert "user_alice" not in sanitized
    assert sanitized.startswith("mongodb+srv://***:***@")

    assert sanitize_mongodb_uri(None) == ""
    assert sanitize_mongodb_uri("") == ""


def test_mongo_indexes_creation(mock_mongo_db):
    """Verify required indexes are declared on threats, timeline_events, and briefings."""
    init_mongo_indexes(mock_mongo_db)

    # Threats collection indexes
    threat_indexes = mock_mongo_db["threats"].index_information()
    assert "idx_threats_created_at" in threat_indexes
    assert "idx_threats_risk_level" in threat_indexes
    assert "idx_threats_status" in threat_indexes
    assert "idx_threats_category" in threat_indexes
    assert "idx_threats_risk_score" in threat_indexes

    # Timeline events collection indexes
    tl_indexes = mock_mongo_db["timeline_events"].index_information()
    assert "idx_timeline_threat_timestamp" in tl_indexes or "idx_timeline_threat_created_at" in tl_indexes

    # Briefings collection unique index
    briefing_indexes = mock_mongo_db["briefings"].index_information()
    assert "idx_briefings_threat_lang_unique" in briefing_indexes
    assert briefing_indexes["idx_briefings_threat_lang_unique"].get("unique") is True


def test_mongo_threat_repository_crud_and_string_id(mock_mongo_db):
    """Test full CRUD operations on MongoThreatRepository, verifying ObjectId is string in response."""
    repo = MongoThreatRepository(mock_mongo_db)

    # 1. Create threat
    threat = repo.create({
        "title": "Zero-Day Exploit in Gateway Router",
        "description": "Active remote code execution targeting perimeter edge router.",
        "category": "Vulnerability",
        "likelihood": 4,
        "impact": 5,
        "status": "Open",
        "affected_asset": "edge-router-01",
    })

    assert isinstance(threat["id"], str)
    assert ObjectId.is_valid(threat["id"])
    assert threat["risk_score"] == 20
    assert threat["risk_level"] == "Critical"
    threat_id = threat["id"]

    # 2. Get by ID
    fetched = repo.get_by_id(threat_id)
    assert fetched is not None
    assert fetched["id"] == threat_id
    assert fetched["title"] == "Zero-Day Exploit in Gateway Router"

    # 3. Update threat
    updated = repo.update(threat_id, {"status": "Investigating", "impact": 4})
    assert updated is not None
    assert updated["status"] == "Investigating"
    assert updated["risk_score"] == 16
    assert updated["risk_level"] == "High"

    # 4. Count
    assert repo.count() == 1

    # 5. Delete threat
    assert repo.delete(threat_id) is True
    assert repo.get_by_id(threat_id) is None
    assert repo.count() == 0


def test_mongo_threat_pagination_sorting_and_text_search(mock_mongo_db):
    """Test pagination, sorting options (newest, highest_risk), and text search (q)."""
    repo = MongoThreatRepository(mock_mongo_db)

    # Create 5 sample threats with varied scores and titles
    sample_data = [
        {"title": "Alpha Ransomware Attack", "category": "Ransomware", "likelihood": 5, "impact": 5, "asset": "srv-1"}, # 25 Crit
        {"title": "Beta Phishing Campaign", "category": "Phishing", "likelihood": 3, "impact": 2, "asset": "srv-2"},     # 6 Med
        {"title": "Gamma SQL Injection", "category": "Vulnerability", "likelihood": 4, "impact": 4, "asset": "srv-3"},   # 16 High
        {"title": "Delta DDoS Volumetric", "category": "DDoS", "likelihood": 2, "impact": 2, "asset": "srv-4"},          # 4 Low
        {"title": "Epsilon Cloud Exposure S3", "category": "Cloud Misconfiguration", "likelihood": 4, "impact": 5, "asset": "srv-5"}, # 20 Crit
    ]

    for item in sample_data:
        repo.create({
            "title": item["title"],
            "description": f"Detailed security event description for {item['title']}",
            "category": item["category"],
            "likelihood": item["likelihood"],
            "impact": item["impact"],
            "status": "Open",
            "affected_asset": item["asset"],
        })

    assert repo.count() == 5

    # 1. Text search 'q'
    results, count = repo.list(q="ransomware")
    assert count == 1
    assert results[0]["title"] == "Alpha Ransomware Attack"

    # 2. Text search across description
    results, count = repo.list(search="SQL Injection")
    assert count == 1
    assert results[0]["title"] == "Gamma SQL Injection"

    # 3. Pagination: page 1 of size 2, highest risk first
    page1, total = repo.list(sort_by="highest_risk", skip=0, limit=2)
    assert total == 5
    assert len(page1) == 2
    assert page1[0]["risk_score"] == 25
    assert page1[1]["risk_score"] == 20

    # Page 2 of size 2
    page2, total = repo.list(sort_by="highest_risk", skip=2, limit=2)
    assert total == 5
    assert len(page2) == 2
    assert page2[0]["risk_score"] == 16

    # 4. Sorting: lowest risk first
    lowest_first, _ = repo.list(sort_by="lowest_risk", skip=0, limit=1)
    assert lowest_first[0]["risk_score"] == 4


def test_mongo_stats_aggregation_pipelines(mock_mongo_db):
    """Test GET /stats aggregation pipeline returns correct counts by level, status, category, and trend."""
    repo = MongoThreatRepository(mock_mongo_db)

    # Seed 3 threats
    repo.create({
        "title": "Critical Threat",
        "description": "High impact incident",
        "category": "Ransomware",
        "likelihood": 5,
        "impact": 5,
        "status": "Open",
        "affected_asset": "srv-crit",
    })
    repo.create({
        "title": "High Threat",
        "description": "Severe credential leak",
        "category": "Credential Attack",
        "likelihood": 4,
        "impact": 4,
        "status": "Investigating",
        "affected_asset": "srv-high",
    })
    repo.create({
        "title": "Low Threat",
        "description": "Minor banner issue",
        "category": "Vulnerability",
        "likelihood": 1,
        "impact": 2,
        "status": "Closed",
        "affected_asset": "srv-low",
    })

    stats = repo.get_stats()

    assert stats["total_threats"] == 3
    assert stats["by_level"]["Critical"] == 1
    assert stats["by_level"]["High"] == 1
    assert stats["by_level"]["Low"] == 1
    assert stats["by_level"]["Medium"] == 0

    assert stats["by_status"]["Open"] == 1
    assert stats["by_status"]["Investigating"] == 1
    assert stats["by_status"]["Closed"] == 1
    assert stats["by_status"]["Mitigated"] == 0

    assert stats["by_category"]["Ransomware"] == 1
    assert stats["by_category"]["Credential Attack"] == 1

    assert stats["average_risk_score"] > 0
    assert len(stats["trend_30d"]) == 30


def test_mongo_timeline_and_cascade_delete(mock_mongo_db):
    """Test MongoTimelineRepository records audit events and deletes by threat."""
    threat_repo = MongoThreatRepository(mock_mongo_db)
    tl_repo = MongoTimelineRepository(mock_mongo_db)

    threat = threat_repo.create({
        "title": "Compromised Service Account",
        "description": "Anomalous tokens observed in access logs.",
        "category": "Credential Attack",
        "likelihood": 3,
        "impact": 4,
        "status": "Open",
        "affected_asset": "svc-auth",
    })
    threat_id = threat["id"]

    # Add 2 timeline events
    ev1 = tl_repo.create(threat_id, "CREATED", "Threat initialized")
    ev2 = tl_repo.create(threat_id, "STATUS_CHANGED", "Assigned to SOC tier 2")

    assert ev1["threat_id"] == threat_id
    assert ev2["threat_id"] == threat_id

    events = tl_repo.list_by_threat(threat_id)
    assert len(events) == 2

    # Cascade delete
    deleted_count = tl_repo.delete_by_threat(threat_id)
    assert deleted_count == 2
    assert len(tl_repo.list_by_threat(threat_id)) == 0


def test_mongo_briefing_cache_unique_index(mock_mongo_db):
    """Verify unique constraint on (threat_id, lang) and cache operations in briefings collection."""
    repo = MongoBriefingCacheRepository(mock_mongo_db)

    # Valid audio base64 (>100 bytes)
    valid_audio_b64 = "UklGRkIAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

    data = {
        "threat_id": "threat-100",
        "language_code": "en-IN",
        "original_english": "English briefing text sentence one. Sentence two. Sentence three.",
        "briefing_text": "English briefing text sentence one. Sentence two. Sentence three.",
        "audio_base64": valid_audio_b64,
    }

    assert repo.set("threat-100", "en-IN", data) is True

    # Retrieve
    cached = repo.get("threat-100", "en-IN")
    assert cached is not None
    assert cached["cached"] is True
    assert cached["audio_base64"] == valid_audio_b64

    # Invalidate
    repo.invalidate_threat("threat-100")
    assert repo.get("threat-100", "en-IN") is None


def test_api_endpoints_with_mongo_override(mock_mongo_db, monkeypatch):
    """Test full FastAPI REST endpoints using mongomock as active backend."""
    set_mongo_db_override(mock_mongo_db)
    settings = get_settings()
    monkeypatch.setattr(settings, "DB_BACKEND", "mongo")
    monkeypatch.setattr(settings, "DB_FALLBACK", False)

    try:
        with TestClient(app) as test_client:
            # 1. Health endpoint under Mongo
            health_res = test_client.get("/health")
            assert health_res.status_code == 200
            health_data = health_res.json()
            assert health_data["status"] == "healthy"
            assert health_data["database"]["backend"] == "mongo"
            assert health_data["database"]["reachable"] is True

            # 2. Create threat via POST /threats
            create_payload = {
                "title": "API Gateway Distributed Denial of Service",
                "description": "High volume SYN flood degrading edge proxy services.",
                "category": "DDoS",
                "likelihood": 4,
                "impact": 4,
                "status": "Open",
                "affected_asset": "edge-gw-01",
            }
            create_res = test_client.post("/threats", json=create_payload)
            assert create_res.status_code == 201
            created = create_res.json()
            threat_id = created["id"]
            assert isinstance(threat_id, str)
            assert ObjectId.is_valid(threat_id)
            assert created["risk_score"] == 16
            assert created["risk_level"] == "High"

            # 3. GET /threats with pagination and X-Total-Count header
            list_res = test_client.get("/threats?sort_by=highest_risk")
            assert list_res.status_code == 200
            assert "X-Total-Count" in list_res.headers
            assert list_res.headers["X-Total-Count"] == "1"
            threats_list = list_res.json()
            assert len(threats_list) == 1
            assert threats_list[0]["id"] == threat_id

            # 4. GET /threats with paginate=true
            paged_res = test_client.get("/threats?paginate=true&limit=10")
            assert paged_res.status_code == 200
            paged_data = paged_res.json()
            assert paged_data["total"] == 1
            assert len(paged_data["items"]) == 1
            assert paged_data["items"][0]["id"] == threat_id

            # 5. GET /threats/{threat_id}
            get_res = test_client.get(f"/threats/{threat_id}")
            assert get_res.status_code == 200
            assert get_res.json()["title"] == create_payload["title"]

            # 6. GET /threats/{threat_id}/timeline
            tl_res = test_client.get(f"/threats/{threat_id}/timeline")
            assert tl_res.status_code == 200
            events = tl_res.json()
            assert len(events) == 1
            assert events[0]["event_type"] == "CREATED"

            # 7. GET /stats
            stats_res = test_client.get("/stats")
            assert stats_res.status_code == 200
            stats_data = stats_res.json()
            assert stats_data["total_threats"] == 1
            assert stats_data["by_level"]["High"] == 1

            # 8. DELETE /threats/{threat_id}
            del_res = test_client.delete(f"/threats/{threat_id}")
            assert del_res.status_code == 200

            assert test_client.get(f"/threats/{threat_id}").status_code == 404
    finally:
        set_mongo_db_override(None)


def test_health_endpoint_mongo_failure_without_fallback(monkeypatch):
    """Ensure that if Mongo is unreachable and DB_FALLBACK=False, /health returns 503 and reports error."""
    set_mongo_db_override(None)
    settings = get_settings()
    monkeypatch.setattr(settings, "DB_BACKEND", "mongo")
    monkeypatch.setattr(settings, "DB_FALLBACK", False)
    monkeypatch.setattr(settings, "MONGODB_URI", "mongodb://unreachable.fake.local:27017")

    # Mock check_mongo_connection returning False
    monkeypatch.setattr("app.core.mongo.check_mongo_connection", lambda timeout_ms=2500: (False, "Connection refused"))
    monkeypatch.setattr("app.repositories.dependencies.check_mongo_connection", lambda timeout_ms=2500: (False, "Connection refused"))

    with TestClient(app) as test_client:
        res = test_client.get("/health")
        assert res.status_code == 503
        data = res.json()
        assert data["status"] == "unhealthy"
        assert data["database"]["backend"] == "mongo"
        assert data["database"]["reachable"] is False
        assert data["database"]["fallback"] is False
        assert "Connection refused" in data["database"]["error"]
        # Ensure raw password/secrets are NEVER in response
        assert "unreachable.fake.local:27017" not in data["database"]["error"]


def test_health_endpoint_mongo_failure_with_fallback(monkeypatch):
    """Ensure that if Mongo is unreachable and DB_FALLBACK=True, backend falls back to SQLite."""
    set_mongo_db_override(None)
    settings = get_settings()
    monkeypatch.setattr(settings, "DB_BACKEND", "mongo")
    monkeypatch.setattr(settings, "DB_FALLBACK", True)

    monkeypatch.setattr("app.core.mongo.check_mongo_connection", lambda timeout_ms=2500: (False, "Timeout connecting to Mongo"))
    monkeypatch.setattr("app.repositories.dependencies.check_mongo_connection", lambda timeout_ms=2500: (False, "Timeout connecting to Mongo"))

    with TestClient(app) as test_client:
        res = test_client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["database"]["backend"] == "sqlite"
        assert data["database"]["reachable"] is True
        assert data["database"]["fallback"] is True
