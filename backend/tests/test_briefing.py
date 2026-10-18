import base64
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.sarvam import SarvamClient
from app.services.briefing_cache import briefing_cache, is_valid_audio_base64


client = TestClient(app)

# 244-byte valid WAV audio for mock testing (>100 bytes requirement)
VALID_MOCK_WAV_BYTES = (
    b"RIFF"
    + (244).to_bytes(4, "little")
    + b"WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data"
    + (200).to_bytes(4, "little")
    + (b"\x55" * 200)
)
VALID_MOCK_AUDIO_B64 = base64.b64encode(VALID_MOCK_WAV_BYTES).decode("ascii")


def test_is_valid_audio_base64():
    """Ensure audio validator rejects empty, invalid, and <=100 byte audio."""
    assert not is_valid_audio_base64("")
    assert not is_valid_audio_base64(None)
    assert not is_valid_audio_base64("not-base-64!!")
    # 44-byte silent WAV header should be rejected
    silent_header_44 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
    assert not is_valid_audio_base64(silent_header_44)
    # 244-byte valid audio should pass
    assert is_valid_audio_base64(VALID_MOCK_AUDIO_B64)


def test_briefing_threat_not_found():
    """Ensure non-existent threat returns 404."""
    res = client.post("/threats/999999/briefing?lang=en-IN")
    assert res.status_code == 404


def test_briefing_missing_api_key_returns_503():
    """Ensure that calling briefing without SARVAM_API_KEY returns 503 error."""
    briefing_cache.clear()
    with patch.object(SarvamClient, "has_api_key", False):
        res = client.post("/threats/1/briefing?lang=en-IN")
        assert res.status_code == 503
        assert "SARVAM_API_KEY is not configured" in res.json()["detail"]


def test_briefing_unsupported_language_returns_400():
    """Ensure languages not supported by both Mayura and Bulbul v3 are rejected."""
    res = client.post("/threats/1/briefing?lang=fr-FR")
    assert res.status_code == 400
    assert "not supported" in res.json()["detail"]


def test_briefing_english_generation_and_caching():
    """Test generating English briefing and verify in-memory cache hit on second call."""
    briefing_cache.clear()

    with patch.object(SarvamClient, "has_api_key", True):
        with patch.object(SarvamClient, "synthesize", return_value={"audios": [VALID_MOCK_AUDIO_B64]}):
            # 1. First call - not cached
            res1 = client.post("/threats/1/briefing?lang=en-IN")
            assert res1.status_code == 200
            data1 = res1.json()

            assert data1["threat_id"] == 1
            assert data1["language_code"] == "en-IN"
            assert data1["cached"] is False
            assert len(data1["original_english"]) > 20
            assert data1["briefing_text"] == data1["original_english"]
            assert data1["audio_base64"] == VALID_MOCK_AUDIO_B64

            # Verify 3 sentences structure
            sentences = [s.strip() for s in data1["original_english"].split(".") if s.strip()]
            assert len(sentences) >= 3

            # 2. Second call - MUST be cached to save API credits
            res2 = client.post("/threats/1/briefing?lang=en-IN")
            assert res2.status_code == 200
            data2 = res2.json()

            assert data2["cached"] is True
            assert data2["briefing_text"] == data1["briefing_text"]
            assert data2["audio_base64"] == data1["audio_base64"]


def test_briefing_bypass_cache():
    """Verify that bypass_cache=True forces a fresh Sarvam call."""
    briefing_cache.clear()

    with patch.object(SarvamClient, "has_api_key", True):
        with patch.object(SarvamClient, "synthesize", return_value={"audios": [VALID_MOCK_AUDIO_B64]}) as mock_synth:
            # 1. First call -> synthesizes and caches
            res1 = client.post("/threats/1/briefing?lang=en-IN")
            assert res1.status_code == 200
            assert res1.json()["cached"] is False
            assert mock_synth.call_count == 1

            # 2. Normal second call -> hits cache (mock_synth count remains 1)
            res2 = client.post("/threats/1/briefing?lang=en-IN")
            assert res2.status_code == 200
            assert res2.json()["cached"] is True
            assert mock_synth.call_count == 1

            # 3. Third call with bypass_cache=True -> must bypass cache (mock_synth count increments to 2)
            res3 = client.post("/threats/1/briefing?lang=en-IN&bypass_cache=true")
            assert res3.status_code == 200
            assert res3.json()["cached"] is False
            assert mock_synth.call_count == 2


def test_briefing_multilingual_mock_sarvam():
    """Test translation and TTS synthesis in Hindi with mocked Sarvam responses."""
    briefing_cache.clear()

    mock_translated = "सुरक्षा ब्रीफिंग: प्रोडक्शन डेटाबेस पर हमला। जोखिम स्तर गंभीर है। प्रतिक्रिया समय 4 घंटे है।"

    with patch.object(SarvamClient, "has_api_key", True):
        with patch.object(SarvamClient, "translate", return_value={"translated_text": mock_translated}):
            with patch.object(SarvamClient, "synthesize", return_value={"audios": [VALID_MOCK_AUDIO_B64]}):
                res = client.post("/threats/1/briefing?lang=hi-IN")
                assert res.status_code == 200
                data = res.json()

                assert data["language_code"] == "hi-IN"
                assert data["briefing_text"] == mock_translated
                assert data["audio_base64"] == VALID_MOCK_AUDIO_B64
                assert data["cached"] is False


def test_briefing_cache_invalidation_on_threat_update():
    """Verify that updating a threat invalidates its cached briefings."""
    briefing_cache.clear()

    with patch.object(SarvamClient, "has_api_key", True):
        with patch.object(SarvamClient, "synthesize", return_value={"audios": [VALID_MOCK_AUDIO_B64]}):
            # Call briefing to populate cache
            res1 = client.post("/threats/1/briefing?lang=en-IN")
            assert res1.status_code == 200
            assert res1.json()["cached"] is False

            # Second call is cached
            res2 = client.post("/threats/1/briefing?lang=en-IN")
            assert res2.json()["cached"] is True

            # Update threat 1
            update_res = client.patch("/threats/1", json={"status": "Mitigated"})
            assert update_res.status_code == 200

            # Call briefing again -> cache should have been invalidated
            res3 = client.post("/threats/1/briefing?lang=en-IN")
            assert res3.status_code == 200
            assert res3.json()["cached"] is False
            assert "Mitigated" in res3.json()["original_english"]
