import io
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.sarvam import SarvamClient


client = TestClient(app)


def test_voice_report_empty_file_rejected():
    """Ensure empty audio upload is rejected with 422."""
    files = {"file": ("empty.wav", b"", "audio/wav")}
    res = client.post("/voice/report", files=files, data={"language_code": "en-IN"})
    assert res.status_code == 422
    assert "empty" in res.json()["detail"].lower()


def test_voice_report_oversized_file_rejected():
    """Ensure audio upload exceeding 5 MB is rejected with 413."""
    # 5 MB + 1024 bytes
    oversized = b"0" * (5 * 1024 * 1024 + 1024)
    files = {"file": ("big.wav", oversized, "audio/wav")}
    res = client.post("/voice/report", files=files, data={"language_code": "en-IN"})
    assert res.status_code == 413
    assert "5 MB limit" in res.json()["detail"]


def test_voice_report_success_mock_fallback():
    """Test voice report endpoint returns transcripts and complete threat assessment."""
    fake_wav = b"RIFF....WAVEfmt ....data...."
    files = {"file": ("audio.wav", fake_wav, "audio/wav")}
    res = client.post("/voice/report", files=files, data={"language_code": "hi-IN"})
    assert res.status_code == 200
    data = res.json()

    assert "transcript_original" in data
    assert "transcript_english" in data
    assert len(data["transcript_original"]) > 5
    assert len(data["transcript_english"]) > 5
    assert data["language_code"] == "hi-IN"

    assessment = data["assessment"]
    assert assessment["category"] in [
        "Phishing", "Ransomware", "Data Breach", "Vulnerability",
        "Third-Party Risk", "Credential Attack", "Cloud Misconfiguration",
        "Insider Threat", "DDoS", "Malware"
    ]
    assert 1 <= assessment["likelihood"] <= 5
    assert 1 <= assessment["impact"] <= 5
    assert assessment["risk_score"] == assessment["likelihood"] * assessment["impact"]
    assert assessment["risk_level"] in ["Low", "Medium", "High", "Critical"]
    assert assessment["response_timeline_hours"] in [4, 24, 72, 168]
    assert len(assessment["recommended_actions"]) == 3


def test_voice_report_with_sarvam_stt_and_translate_mock():
    """Test voice report calling SarvamClient STT and Translate with mocked responses."""
    fake_wav = b"RIFF....WAVEfmt ....data...."
    files = {"file": ("audio.wav", fake_wav, "audio/wav")}

    mock_stt = {
        "request_id": "stt-101",
        "transcript": "डेटाबेस लीक हो गया है",
        "language_code": "hi-IN",
    }
    mock_trans = {
        "request_id": "trans-202",
        "translated_text": "Database has been leaked and customer records exposed.",
        "source_language_code": "hi-IN",
    }

    with patch.object(SarvamClient, "has_api_key", True):
        with patch.object(SarvamClient, "transcribe", return_value=mock_stt):
            with patch.object(SarvamClient, "translate", return_value=mock_trans):
                res = client.post("/voice/report", files=files, data={"language_code": "hi-IN"})
                assert res.status_code == 200
                data = res.json()

                assert data["transcript_original"] == "डेटाबेस लीक हो गया है"
                assert data["transcript_english"] == "Database has been leaked and customer records exposed."
                assert data["assessment"]["category"] == "Data Breach"


def test_voice_report_api_v1_alias():
    """Verify endpoint is also available under /api/v1/voice/report."""
    fake_wav = b"RIFF....WAVEfmt ....data...."
    files = {"file": ("audio.wav", fake_wav, "audio/wav")}
    res = client.post("/api/v1/voice/report", files=files, data={"language_code": "en-IN"})
    assert res.status_code == 200
    assert "assessment" in res.json()
