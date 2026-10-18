import io
import json
import pytest
import httpx
from unittest.mock import MagicMock, patch

from app.services.sarvam import (
    SarvamClient,
    SarvamError,
    SarvamAuthError,
    SarvamAPIError,
    SarvamTimeoutError,
    SarvamConnectionError,
)


SECRET_KEY = "test_sarvam_secret_key_12345"


def test_sarvam_client_repr_masks_key():
    """Ensure API key is never exposed in string representations."""
    client = SarvamClient(api_key=SECRET_KEY)
    assert SECRET_KEY not in repr(client)
    assert SECRET_KEY not in str(client)
    assert "***" in repr(client)


def test_sarvam_client_missing_key_raises_auth_error():
    """Ensure missing key raises SarvamAuthError before making requests."""
    client = SarvamClient(api_key="")
    with pytest.raises(SarvamAuthError) as exc_info:
        client.transcribe(b"test audio")
    assert "SARVAM_API_KEY is not set" in str(exc_info.value)


def test_transcribe_success():
    """Test successful speech-to-text with default saaras:v3 model."""
    mock_response = httpx.Response(
        status_code=200,
        json={
            "request_id": "req-stt-123",
            "transcript": "सुरक्षा घटना का पता चला",
            "language_code": "hi-IN",
        },
        request=httpx.Request("POST", "https://api.sarvam.ai/speech-to-text"),
    )

    with patch.object(httpx.Client, "post", return_value=mock_response) as mock_post:
        client = SarvamClient(api_key=SECRET_KEY)
        res = client.transcribe(b"audio-bytes-content", language="hi-IN")

        assert res["transcript"] == "सुरक्षा घटना का पता चला"
        assert res["language_code"] == "hi-IN"
        assert mock_post.called

        # Verify call arguments
        call_args = mock_post.call_args
        headers = call_args.kwargs["headers"]
        data = call_args.kwargs["data"]
        files = call_args.kwargs["files"]

        assert headers["api-subscription-key"] == SECRET_KEY
        assert data["model"] == "saaras:v3"
        assert data["language_code"] == "hi-IN"
        assert "file" in files


def test_translate_success():
    """Test successful translation with default mayura:v1 model."""
    mock_response = httpx.Response(
        status_code=200,
        json={
            "request_id": "req-trans-456",
            "translated_text": "सुरक्षा अलर्ट: अनधिकृत पहुंच",
            "source_language_code": "en-IN",
        },
        request=httpx.Request("POST", "https://api.sarvam.ai/translate"),
    )

    with patch.object(httpx.Client, "post", return_value=mock_response) as mock_post:
        client = SarvamClient(api_key=SECRET_KEY)
        res = client.translate(
            text="Security alert: unauthorized access",
            source="en-IN",
            target="hi-IN",
        )

        assert res["translated_text"] == "सुरक्षा अलर्ट: अनधिकृत पहुंच"
        assert mock_post.called

        call_args = mock_post.call_args
        headers = call_args.kwargs["headers"]
        payload = call_args.kwargs["json"]

        assert headers["api-subscription-key"] == SECRET_KEY
        assert payload["model"] == "mayura:v1"
        assert payload["source_language_code"] == "en-IN"
        assert payload["target_language_code"] == "hi-IN"


def test_synthesize_success():
    """Test text-to-speech with default bulbul:v3 model."""
    mock_response = httpx.Response(
        status_code=200,
        json={
            "request_id": "req-tts-789",
            "audios": ["UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="],
        },
        request=httpx.Request("POST", "https://api.sarvam.ai/text-to-speech"),
    )

    with patch.object(httpx.Client, "post", return_value=mock_response) as mock_post:
        client = SarvamClient(api_key=SECRET_KEY)
        res = client.synthesize(text="Critical security vulnerability detected", language="en-IN")

        assert len(res["audios"]) == 1
        assert mock_post.called

        call_args = mock_post.call_args
        payload = call_args.kwargs["json"]
        assert payload["model"] == "bulbul:v3"
        assert payload["speaker"] == "shubh"
        assert payload["language_code"] == "en-IN"


def test_chat_success():
    """Test chat completions with default sarvam-105b model."""
    mock_response = httpx.Response(
        status_code=200,
        json={
            "id": "chatcmpl-999",
            "object": "chat.completion",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": '{"category": "Ransomware", "likelihood": 4, "impact": 5}',
                    },
                    "finish_reason": "stop",
                }
            ],
        },
        request=httpx.Request("POST", "https://api.sarvam.ai/chat/completions"),
    )

    with patch.object(httpx.Client, "post", return_value=mock_response) as mock_post:
        client = SarvamClient(api_key=SECRET_KEY)
        messages = [{"role": "user", "content": "Analyze incident"}]
        res = client.chat(messages=messages)

        assert res["choices"][0]["message"]["content"] is not None
        assert mock_post.called

        call_args = mock_post.call_args
        payload = call_args.kwargs["json"]
        assert payload["model"] == "sarvam-105b"
        assert payload["messages"] == messages


def test_auth_error_handling_401():
    """Ensure HTTP 401 raises SarvamAuthError without leaking key."""
    mock_response = httpx.Response(
        status_code=401,
        json={"error": {"message": "Invalid API key provided", "code": "invalid_api_key_error"}},
        request=httpx.Request("POST", "https://api.sarvam.ai/translate"),
    )

    with patch.object(httpx.Client, "post", return_value=mock_response):
        client = SarvamClient(api_key=SECRET_KEY)
        with pytest.raises(SarvamAuthError) as exc_info:
            client.translate("test", "en-IN", "hi-IN")
        assert "Invalid API key provided" in str(exc_info.value)
        assert SECRET_KEY not in str(exc_info.value)


def test_api_error_handling_422():
    """Ensure HTTP 422 raises SarvamAPIError with error code."""
    mock_response = httpx.Response(
        status_code=422,
        json={"error": {"message": "Input text too long", "code": "unprocessable_entity_error", "request_id": "req-422"}},
        request=httpx.Request("POST", "https://api.sarvam.ai/translate"),
    )

    with patch.object(httpx.Client, "post", return_value=mock_response):
        client = SarvamClient(api_key=SECRET_KEY)
        with pytest.raises(SarvamAPIError) as exc_info:
            client.translate("x" * 10000, "en-IN", "hi-IN")
        assert exc_info.value.status_code == 422
        assert exc_info.value.error_code == "unprocessable_entity_error"
        assert exc_info.value.request_id == "req-422"
        assert SECRET_KEY not in str(exc_info.value)


def test_timeout_handling():
    """Ensure httpx.TimeoutException maps to SarvamTimeoutError."""
    with patch.object(httpx.Client, "post", side_effect=httpx.ReadTimeout("Read timed out")):
        client = SarvamClient(api_key=SECRET_KEY, timeout=5.0)
        with pytest.raises(SarvamTimeoutError) as exc_info:
            client.translate("test", "en-IN", "hi-IN")
        assert "timed out" in str(exc_info.value)
        assert SECRET_KEY not in str(exc_info.value)


def test_connection_error_handling():
    """Ensure network connection failure maps to SarvamConnectionError."""
    with patch.object(httpx.Client, "post", side_effect=httpx.ConnectError("Connection refused")):
        client = SarvamClient(api_key=SECRET_KEY)
        with pytest.raises(SarvamConnectionError) as exc_info:
            client.translate("test", "en-IN", "hi-IN")
        assert "Network error" in str(exc_info.value)
        assert SECRET_KEY not in str(exc_info.value)
