import json
import pytest
from unittest.mock import patch, MagicMock
import httpx

from fastapi.testclient import TestClient
from app.main import app
from app.schemas.threat import ThreatCategory, RiskLevel
from app.services.risk_model import (
    MockRiskModelClient,
    SarvamRiskModelClient,
    OllamaRiskModelClient,
    get_risk_model_client,
    rule_based_scorer,
    extract_first_json_block,
)
from app.services.sarvam import SarvamClient, SarvamError


client = TestClient(app)


def test_mock_risk_model_ransomware():
    mock_client = MockRiskModelClient()
    result = mock_client.assess("Critical incident: Ransomware deployed across network fileshares, files encrypted with .locked extension and bitcoin demand left.")
    
    assert result.category == ThreatCategory.RANSOMWARE
    assert result.likelihood == 4
    assert result.impact == 5
    assert len(result.recommended_actions) == 3
    assert result.fallback is False
    assert result.backend_used == "mock"


def test_mock_risk_model_phishing():
    mock_client = MockRiskModelClient()
    result = mock_client.assess("Multiple employees reported suspicious email spear phish with fake login page.")
    
    assert result.category == ThreatCategory.PHISHING
    assert result.likelihood == 4
    assert result.impact == 3
    assert len(result.recommended_actions) == 3


def test_mock_risk_model_cloud_misconfig():
    mock_client = MockRiskModelClient()
    result = mock_client.assess("Public AWS S3 bucket holding production database backups exposed to the open internet.")
    
    assert result.category == ThreatCategory.CLOUD_MISCONFIGURATION
    assert len(result.recommended_actions) == 3


def test_ai_assess_endpoint_success_mock():
    """Test POST /ai/assess using the mock backend."""
    with patch("app.api.v1.endpoints.ai.get_risk_model_client", return_value=MockRiskModelClient()):
        response = client.post(
            "/ai/assess",
            json={"event_text": "Massive DDoS attack targeting main gateway with high-volume UDP amplification flood."},
        )
        assert response.status_code == 200
        data = response.json()

        assert data["category"] == "DDoS"
        assert 1 <= data["likelihood"] <= 5
        assert 1 <= data["impact"] <= 5
        assert data["risk_score"] == data["likelihood"] * data["impact"]
        assert data["risk_level"] in ["Low", "Medium", "High", "Critical"]
        assert data["response_timeline_hours"] in [4, 24, 72, 168]
        assert len(data["recommended_actions"]) == 3
        assert data["fallback"] is False
        assert data["backend_used"] == "mock"
        assert len(data["reasoning"]) > 5


def test_ai_assess_endpoint_aliased_api_v1():
    """Test that POST /api/v1/ai/assess resolves identically."""
    with patch("app.api.v1.endpoints.ai.get_risk_model_client", return_value=MockRiskModelClient()):
        response = client.post(
            "/api/v1/ai/assess",
            json={"event_text": "Zero-day vulnerability CVE-2026-1001 remote code execution found in edge router."},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "Vulnerability"


def test_ai_assess_endpoint_validation_empty_text():
    """Test validation rejection for blank event_text."""
    response = client.post("/ai/assess", json={"event_text": "   "})
    assert response.status_code == 422


def test_sarvam_risk_model_missing_key_falls_back():
    """Ensure SarvamRiskModelClient falls back to mock when key is missing."""
    mock_sarvam_api = SarvamClient(api_key="")
    sarvam_model = SarvamRiskModelClient(sarvam_client=mock_sarvam_api)

    result = sarvam_model.assess("Suspicious credential stuffing and unauthorized SSH brute-force detected.")
    assert result.fallback is True
    assert "fallback from sarvam" in result.backend_used
    assert result.category == ThreatCategory.CREDENTIAL_ATTACK
    assert len(result.recommended_actions) == 3


def test_sarvam_risk_model_success_with_json_validation():
    """Ensure SarvamRiskModelClient validates JSON and extracts fields properly."""
    sarvam_mock_response = {
        "id": "chatcmpl-test",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "category": "Data Breach",
                        "likelihood": 4,
                        "impact": 5,
                        "reasoning": "Large scale database dump detected on hacker forum matching customer records.",
                        "recommended_actions": [
                            "Engage forensic data recovery team",
                            "Initiate regulatory breach notification procedures",
                            "Rotate all database root access credentials"
                        ]
                    })
                }
            }
        ]
    }

    mock_sarvam_api = SarvamClient(api_key="valid_dummy_key_12345")
    with patch.object(mock_sarvam_api, "chat", return_value=sarvam_mock_response):
        sarvam_model = SarvamRiskModelClient(sarvam_client=mock_sarvam_api)
        result = sarvam_model.assess("Customer database dump found online.")

        assert result.category == ThreatCategory.DATA_BREACH
        assert result.likelihood == 4
        assert result.impact == 5
        assert result.fallback is False
        assert result.backend_used == "sarvam"
        assert len(result.recommended_actions) == 3


def test_sarvam_risk_model_handles_api_failure_with_fallback():
    """Ensure SarvamRiskModelClient gracefully falls back to mock on API errors."""
    mock_sarvam_api = SarvamClient(api_key="valid_dummy_key_12345")
    with patch.object(mock_sarvam_api, "chat", side_effect=SarvamError("500 Internal Server Error")):
        sarvam_model = SarvamRiskModelClient(sarvam_client=mock_sarvam_api)
        result = sarvam_model.assess("Ransomware encryption detected on production server.")

        assert result.fallback is True
        assert "fallback from sarvam" in result.backend_used
        assert result.category == ThreatCategory.RANSOMWARE


def test_rule_based_scorer_keywords():
    """Verify rule_based_scorer keyword behavior for likelihood and impact."""
    # Baseline
    l, i = rule_based_scorer("Standard internal security audit check.")
    assert l == 3 and i == 3

    # internet-facing
    l, i = rule_based_scorer("Internal threat vs internet-facing web API.")
    assert l == 4 and i == 3

    # exploited
    l, i = rule_based_scorer("Known vulnerability actively exploited in the wild.")
    assert l == 4 and i == 4

    # internet-facing + exploited
    l, i = rule_based_scorer("Internet-facing edge portal actively exploited by adversaries.")
    assert l == 5 and i == 4

    # without MFA
    l, i = rule_based_scorer("Administrative portal accessed without MFA.")
    assert l == 4 and i == 4

    # regulated data
    l, i = rule_based_scorer("Unauthorized export of regulated data including customer PII and cardholder records.")
    assert i == 5

    # backups encrypted
    l, i = rule_based_scorer("Ransomware payload executed with backups encrypted.")
    assert i == 5

    # offline backups + monitoring detected
    l, i = rule_based_scorer("Monitoring detected incident early; verified offline backups available.")
    assert i == 1


def test_extract_first_json_block_formats():
    """Verify defensive JSON block extraction across various LLM formatting styles."""
    # Direct JSON
    res1 = extract_first_json_block('{"category": "Phishing", "likelihood": 4}')
    assert res1 == {"category": "Phishing", "likelihood": 4}

    # Markdown block
    res2 = extract_first_json_block('```json\n{"category": "Ransomware", "impact": 5}\n```')
    assert res2 == {"category": "Ransomware", "impact": 5}

    # Conversational prose wrapping JSON
    res3 = extract_first_json_block(
        'Here is the analysis:\n{"category": "DDoS", "likelihood": 4, "recommended_actions": ["A", "B", "C"]}\nHope this helps!'
    )
    assert res3 == {"category": "DDoS", "likelihood": 4, "recommended_actions": ["A", "B", "C"]}

    # Invalid / empty
    assert extract_first_json_block("No json present here.") is None
    assert extract_first_json_block("") is None


def test_ollama_client_success_and_bounded_calibration():
    """Verify Ollama chat suggestion is parsed defensively and bounded within 1 of rule score."""
    # Event: internet-facing (rule L=4, rule I=3)
    event_text = "Internet-facing login portal under attack."
    
    mock_ollama_response = MagicMock()
    mock_ollama_response.status_code = 200
    # Model suggests L=5 (within |5-4| <= 1 -> accepted) and I=4 (within |4-3| <= 1 -> accepted)
    mock_ollama_response.json.return_value = {
        "message": {
            "content": json.dumps({
                "category": "Credential Attack",
                "likelihood": 5,
                "impact": 4,
                "reasoning": "High-rate credential stuffing on public gateway.",
                "recommended_actions": [
                    "Block malicious IP ranges at edge firewall",
                    "Enforce MFA step-up verification",
                    "Invalidate compromised session tokens"
                ]
            })
        }
    }

    with patch("httpx.post", return_value=mock_ollama_response) as mock_post:
        client = OllamaRiskModelClient(model_url="http://localhost:11434", model_name="cyber-risk")
        result = client.assess(event_text)

        assert mock_post.call_count == 1
        assert result.category == ThreatCategory.CREDENTIAL_ATTACK
        assert result.likelihood == 5  # Accepted within bound
        assert result.impact == 4      # Accepted within bound
        assert result.fallback is False
        assert "ollama (cyber-risk)" in result.backend_used
        assert len(result.recommended_actions) == 3


def test_ollama_client_out_of_bounds_rejection():
    """Verify model suggestions deviating by more than 1 from rule-based score are rejected."""
    # Event: internet-facing + exploited + regulated data (rule L=5, rule I=5)
    event_text = "Internet-facing database actively exploited with regulated data exposed."
    rule_l, rule_i = rule_based_scorer(event_text)
    assert rule_l == 5 and rule_i == 5

    mock_ollama_response = MagicMock()
    mock_ollama_response.status_code = 200
    # Model hallucinates unrealistically low values L=1, I=1 (diff = 4 > 1 -> rejected!)
    mock_ollama_response.json.return_value = {
        "message": {
            "content": json.dumps({
                "category": "Data Breach",
                "likelihood": 1,
                "impact": 1,
                "reasoning": "Minimal exposure detected.",
                "recommended_actions": ["Action 1", "Action 2", "Action 3"]
            })
        }
    }

    with patch("httpx.post", return_value=mock_ollama_response):
        client = OllamaRiskModelClient()
        result = client.assess(event_text)

        # Enforces rule-based scores
        assert result.likelihood == 5
        assert result.impact == 5
        assert result.category == ThreatCategory.DATA_BREACH


def test_ollama_client_retry_on_initial_failure():
    """Verify Ollama client retries once on connection error before succeeding."""
    mock_success_response = MagicMock()
    mock_success_response.status_code = 200
    mock_success_response.json.return_value = {
        "message": {
            "content": json.dumps({
                "category": "Malware",
                "likelihood": 3,
                "impact": 3,
                "recommended_actions": ["Isolate host", "Inspect memory", "Review proxy logs"]
            })
        }
    }

    # Attempt 1 raises ConnectError, Attempt 2 returns 200 OK
    with patch("httpx.post", side_effect=[httpx.ConnectError("Connection refused"), mock_success_response]) as mock_post:
        client = OllamaRiskModelClient()
        result = client.assess("Suspicious process spawned from temporary folder.")

        assert mock_post.call_count == 2
        assert result.fallback is False
        assert result.category == ThreatCategory.MALWARE
        assert len(result.recommended_actions) == 3


def test_ollama_client_fallback_to_sarvam():
    """Verify that when Ollama fails both attempts, it falls back to Sarvam."""
    sarvam_mock_response = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "category": "Phishing",
                        "likelihood": 4,
                        "impact": 3,
                        "reasoning": "Detected phishing payload.",
                        "recommended_actions": ["Action 1", "Action 2", "Action 3"]
                    })
                }
            }
        ]
    }

    mock_sarvam_api = SarvamClient(api_key="valid_dummy_key_12345")
    with patch.object(mock_sarvam_api, "chat", return_value=sarvam_mock_response):
        sarvam_model = SarvamRiskModelClient(sarvam_client=mock_sarvam_api)
        
        # Ollama fails with ConnectError
        with patch("httpx.post", side_effect=httpx.ConnectError("Ollama offline")):
            client = OllamaRiskModelClient(sarvam_client=sarvam_model)
            result = client.assess("Suspicious spear-phishing lure.")

            assert result.fallback is True
            assert "sarvam (fallback from ollama)" in result.backend_used
            assert result.category == ThreatCategory.PHISHING


def test_ollama_client_fallback_to_mock_when_sarvam_unconfigured():
    """Verify that when both Ollama and Sarvam fail (or key missing), it falls back to Mock."""
    mock_sarvam_api = SarvamClient(api_key="")  # No API key -> Sarvam will fail/fallback
    sarvam_model = SarvamRiskModelClient(sarvam_client=mock_sarvam_api)

    with patch("httpx.post", side_effect=httpx.ConnectError("Ollama offline")):
        client = OllamaRiskModelClient(sarvam_client=sarvam_model)
        result = client.assess("Ransomware encrypting file systems on internal server.")

        assert result.fallback is True
        assert "mock (fallback from ollama -> sarvam)" in result.backend_used
        assert result.category == ThreatCategory.RANSOMWARE
        assert len(result.recommended_actions) == 3


def test_endpoint_timeline_hours_calculation():
    """Verify backend recomputes response_timeline_hours according to risk levels."""
    # Critical (score >= 17): e.g. 4x5 = 20 -> 4 hours
    with patch("app.api.v1.endpoints.ai.get_risk_model_client", return_value=MockRiskModelClient()):
        res = client.post("/ai/assess", json={"event_text": "Catastrophic ransomware locking core systems."})
        assert res.status_code == 200
        data = res.json()
        if data["risk_level"] == "Critical":
            assert data["response_timeline_hours"] == 4
        elif data["risk_level"] == "High":
            assert data["response_timeline_hours"] == 24
        elif data["risk_level"] == "Medium":
            assert data["response_timeline_hours"] == 72
        elif data["risk_level"] == "Low":
            assert data["response_timeline_hours"] == 168

