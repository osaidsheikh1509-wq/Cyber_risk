import pytest


def test_create_threat_risk_score_and_levels(client):
    """Verify that likelihood x impact calculates correct score and tier."""
    test_cases = [
        {"likelihood": 1, "impact": 3, "expected_score": 3, "expected_level": "Low"},
        {"likelihood": 2, "impact": 2, "expected_score": 4, "expected_level": "Low"},
        {"likelihood": 3, "impact": 2, "expected_score": 6, "expected_level": "Medium"},
        {"likelihood": 3, "impact": 3, "expected_score": 9, "expected_level": "Medium"},
        {"likelihood": 2, "impact": 5, "expected_score": 10, "expected_level": "High"},
        {"likelihood": 4, "impact": 4, "expected_score": 16, "expected_level": "High"},
        {"likelihood": 4, "impact": 5, "expected_score": 20, "expected_level": "Critical"},
        {"likelihood": 5, "impact": 5, "expected_score": 25, "expected_level": "Critical"},
    ]

    for tc in test_cases:
        payload = {
            "title": f"Test Threat for Score {tc['expected_score']}",
            "description": "Validation of calculation logic and level boundary.",
            "category": "Vulnerability",
            "likelihood": tc["likelihood"],
            "impact": tc["impact"],
            "status": "Open",
            "affected_asset": "test-cluster-node-01",
        }
        res = client.post("/threats", json=payload)
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["risk_score"] == tc["expected_score"]
        assert data["risk_level"] == tc["expected_level"]


def test_validation_likelihood_impact_bounds(client):
    """Ensure likelihood and impact outside 1-5 are rejected with 422."""
    invalid_payloads = [
        {"likelihood": 0, "impact": 3},
        {"likelihood": 6, "impact": 3},
        {"likelihood": 3, "impact": 0},
        {"likelihood": 3, "impact": 6},
    ]

    for inv in invalid_payloads:
        payload = {
            "title": "Invalid Bounds Threat",
            "description": "Should fail schema validation.",
            "category": "Malware",
            "status": "Open",
            "affected_asset": "srv-01",
            **inv,
        }
        res = client.post("/threats", json=payload)
        assert res.status_code == 422


def test_timeline_auto_logging_on_create_and_update(client):
    """Ensure timeline events are generated automatically on creation and updates."""
    # 1. Create threat
    payload = {
        "title": "Initial RCE in Auth Service",
        "description": "Critical vulnerability requiring SOC review.",
        "category": "Vulnerability",
        "likelihood": 2,
        "impact": 2,
        "status": "Open",
        "affected_asset": "auth-service-k8s",
    }
    create_res = client.post("/threats", json=payload)
    assert create_res.status_code == 201
    threat_id = create_res.json()["id"]
    assert create_res.json()["risk_score"] == 4
    assert create_res.json()["risk_level"] == "Low"

    # 2. Check initial timeline event
    tl_res = client.get(f"/threats/{threat_id}/timeline")
    assert tl_res.status_code == 200
    events = tl_res.json()
    assert len(events) == 1
    assert events[0]["event_type"] == "CREATED"

    # 3. Update status
    update_res = client.patch(f"/threats/{threat_id}", json={"status": "Investigating"})
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "Investigating"

    # 4. Update likelihood and impact -> check score recalculation
    recalc_res = client.patch(f"/threats/{threat_id}", json={"likelihood": 5, "impact": 4})
    assert recalc_res.status_code == 200
    assert recalc_res.json()["risk_score"] == 20
    assert recalc_res.json()["risk_level"] == "Critical"

    # 5. Check timeline has all audit records
    tl_res_after = client.get(f"/threats/{threat_id}/timeline")
    after_events = tl_res_after.json()
    assert len(after_events) == 3
    event_types = [e["event_type"] for e in after_events]
    assert "CREATED" in event_types
    assert "STATUS_CHANGED" in event_types
    assert "ASSESSMENT_UPDATED" in event_types


def test_custom_timeline_event(client):
    """Test manual append of audit note to threat timeline."""
    payload = {
        "title": "Phishing lure detected",
        "description": "Email campaign impersonating IT.",
        "category": "Phishing",
        "likelihood": 3,
        "impact": 2,
        "status": "Open",
        "affected_asset": "mail-relay",
    }
    threat_id = client.post("/threats", json=payload).json()["id"]

    post_event = client.post(
        f"/threats/{threat_id}/timeline",
        json={"event_type": "NOTE", "description": "Analyst verified domain matches adversary infrastructure."},
    )
    assert post_event.status_code == 201
    event_data = post_event.json()
    assert event_data["event_type"] == "NOTE"
    assert event_data["threat_id"] == threat_id


def test_seeded_threats_count_and_diversity(seeded_client):
    """Verify 25 realistic threats are seeded with complete category coverage."""
    res = seeded_client.get("/threats?limit=100")
    assert res.status_code == 200
    threats = res.json()
    assert len(threats) == 25

    categories = {t["category"] for t in threats}
    assert len(categories) == 10  # All 10 categories present
    assert "Phishing" in categories
    assert "Ransomware" in categories
    assert "Data Breach" in categories
    assert "Cloud Misconfiguration" in categories

    levels = {t["risk_level"] for t in threats}
    assert levels == {"Low", "Medium", "High", "Critical"}


def test_threat_filtering(seeded_client):
    """Test filtering GET /threats by category, status, risk_level, score range, asset."""
    # Filter by category
    res_phish = seeded_client.get("/threats?category=Phishing")
    assert res_phish.status_code == 200
    assert all(t["category"] == "Phishing" for t in res_phish.json())
    assert len(res_phish.json()) > 0

    # Filter by risk_level
    res_crit = seeded_client.get("/threats?risk_level=Critical")
    assert res_crit.status_code == 200
    assert all(t["risk_level"] == "Critical" for t in res_crit.json())
    assert all(t["risk_score"] >= 17 for t in res_crit.json())

    # Filter by status
    res_open = seeded_client.get("/threats?status=Open")
    assert res_open.status_code == 200
    assert all(t["status"] == "Open" for t in res_open.json())

    # Filter by score range
    res_range = seeded_client.get("/threats?min_score=10&max_score=16")
    assert res_range.status_code == 200
    for t in res_range.json():
        assert 10 <= t["risk_score"] <= 16
        assert t["risk_level"] == "High"

    # Filter by affected_asset substring
    res_asset = seeded_client.get("/threats?affected_asset=aws")
    assert res_asset.status_code == 200
    assert len(res_asset.json()) > 0
    assert all("aws" in t["affected_asset"].lower() or "s3" in t["affected_asset"].lower() for t in res_asset.json())


def test_stats_and_30d_trend(seeded_client):
    """Verify stats aggregation and 30-day trend data."""
    res = seeded_client.get("/stats")
    assert res.status_code == 200
    data = res.json()

    assert data["total_threats"] == 25
    assert sum(data["by_level"].values()) == 25
    assert sum(data["by_status"].values()) == 25
    assert data["average_risk_score"] > 0

    # Verify 30-day trend array
    trend = data["trend_30d"]
    assert len(trend) == 30
    for day in trend:
        assert "date" in day
        assert "avg_score" in day
        assert "threat_count" in day
        assert "critical_count" in day
        assert day["avg_score"] >= 0


def test_delete_threat_and_cascade(client):
    """Verify threat deletion cascades and removes timeline events."""
    payload = {
        "title": "Ephemeral Threat to Delete",
        "description": "Short-lived threat.",
        "category": "DDoS",
        "likelihood": 2,
        "impact": 2,
        "status": "Closed",
        "affected_asset": "cdn-test",
    }
    threat_id = client.post("/threats", json=payload).json()["id"]
    client.post(f"/threats/{threat_id}/timeline", json={"event_type": "NOTE", "description": "Delete note"})

    # Delete threat
    del_res = client.delete(f"/threats/{threat_id}")
    assert del_res.status_code == 200

    # Ensure threat is gone
    get_res = client.get(f"/threats/{threat_id}")
    assert get_res.status_code == 404

    # Ensure timeline events are gone
    tl_res = client.get(f"/threats/{threat_id}/timeline")
    assert tl_res.status_code == 404
