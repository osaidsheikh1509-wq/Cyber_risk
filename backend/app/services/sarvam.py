import os
from typing import Any, BinaryIO, Dict, List, Optional, Tuple, Union
import httpx

from app.core.config import get_settings


class SarvamError(Exception):
    """Base exception for all Sarvam AI SDK errors."""
    pass


class SarvamAuthError(SarvamError):
    """Raised when API key is missing or invalid (HTTP 401/403)."""
    def __init__(self, message: str = "Sarvam API authentication failed", status_code: int = 401):
        super().__init__(message)
        self.status_code = status_code


class SarvamAPIError(SarvamError):
    """Raised when Sarvam API returns an HTTP error status code (400, 422, 500, etc.)."""
    def __init__(
        self,
        message: str,
        status_code: int,
        error_code: Optional[str] = None,
        request_id: Optional[str] = None,
        details: Optional[Any] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.request_id = request_id
        self.details = details


class SarvamTimeoutError(SarvamError):
    """Raised when an API request to Sarvam times out."""
    pass


class SarvamConnectionError(SarvamError):
    """Raised when network connection to Sarvam AI fails."""
    pass


class SarvamClient:
    """
    Client for interacting with Sarvam AI REST APIs:
    - Speech-to-Text: /speech-to-text (model: saaras:v3)
    - Translation: /translate (model: mayura:v1)
    - Text-to-Speech: /text-to-speech (model: bulbul:v3)
    - Chat Completions: /chat/completions (model: sarvam-105b)

    Security Note:
    API keys are never logged, never exposed in tracebacks/exceptions, and masked in string representations.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        http_client: Optional[httpx.Client] = None,
    ):
        settings = get_settings()
        if api_key is not None:
            self._api_key = api_key.strip()
        else:
            self._api_key = (os.getenv("SARVAM_API_KEY") or settings.SARVAM_API_KEY or "").strip()
        self.base_url = (base_url or os.getenv("SARVAM_BASE_URL") or settings.SARVAM_BASE_URL or "https://api.sarvam.ai").rstrip("/")
        self.timeout = timeout
        self._owns_client = http_client is None
        self._client = http_client or httpx.Client(timeout=timeout)

    @property
    def has_api_key(self) -> bool:
        """Return True if an API key is configured."""
        return bool(self._api_key)

    def _get_auth_headers(self) -> Dict[str, str]:
        """Generate authentication headers. Never logs the key."""
        if not self._api_key:
            raise SarvamAuthError(
                "SARVAM_API_KEY is not set. Please set the SARVAM_API_KEY environment variable or pass api_key to SarvamClient."
            )
        return {
            "api-subscription-key": self._api_key,
        }

    def _handle_response(self, response: httpx.Response) -> Dict[str, Any]:
        """Parse JSON response and raise appropriate typed exceptions on errors."""
        if response.is_success:
            try:
                return response.json()
            except Exception as exc:
                raise SarvamAPIError(
                    message=f"Failed to parse successful JSON response: {str(exc)}",
                    status_code=response.status_code,
                ) from exc

        # Extract error message cleanly without exposing headers or sensitive data
        status_code = response.status_code
        error_code = None
        request_id = None
        message = f"Sarvam API error: HTTP {status_code}"

        try:
            data = response.json()
            if isinstance(data, dict):
                # Sarvam format: {"error": {"message": "...", "code": "...", "request_id": "..."}}
                err = data.get("error")
                if isinstance(err, dict):
                    message = err.get("message") or message
                    error_code = err.get("code")
                    request_id = err.get("request_id")
                elif "detail" in data:
                    message = str(data["detail"])
                elif "message" in data:
                    message = str(data["message"])
                request_id = request_id or data.get("request_id")
        except Exception:
            # Fall back to raw text truncated
            text_snippet = response.text[:200]
            if text_snippet:
                message = f"{message} - {text_snippet}"

        if status_code in (401, 403):
            raise SarvamAuthError(message=message, status_code=status_code)
        
        raise SarvamAPIError(
            message=message,
            status_code=status_code,
            error_code=error_code,
            request_id=request_id,
        )

    def transcribe(
        self,
        audio: Union[bytes, BinaryIO, Tuple[str, bytes], Tuple[str, bytes, str], str],
        language: str = "hi-IN",
        model: str = "saaras:v3",
        mode: str = "transcribe",
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Transcribe speech audio into text via POST /speech-to-text.

        :param audio: Raw audio bytes, file path, file-like object, or (filename, bytes) tuple.
        :param language: Language code (e.g. 'hi-IN', 'en-IN', 'unknown').
        :param model: Speech recognition model, defaults to 'saaras:v3'.
        :param mode: Transcription mode ('transcribe', 'translate', 'verbatim', 'translit', 'codemix').
        :return: Dict containing request_id, transcript, and language_code.
        """
        url = f"{self.base_url}/speech-to-text"
        headers = self._get_auth_headers()

        # Format audio into multipart form
        file_tuple: Tuple[str, Any, str]
        if isinstance(audio, (bytes, bytearray)):
            file_tuple = ("audio.wav", bytes(audio), "audio/wav")
        elif isinstance(audio, tuple):
            if len(audio) == 2:
                file_tuple = (audio[0], audio[1], "audio/wav")
            else:
                file_tuple = (audio[0], audio[1], audio[2])
        elif isinstance(audio, str):
            if os.path.exists(audio):
                with open(audio, "rb") as f:
                    file_tuple = (os.path.basename(audio), f.read(), "audio/wav")
            else:
                raise ValueError(f"Audio file path does not exist: {audio}")
        elif hasattr(audio, "read"):
            data = audio.read()
            file_tuple = ("audio.wav", data, "audio/wav")
        else:
            raise TypeError(f"Unsupported audio type: {type(audio)}")

        files = {"file": file_tuple}
        data: Dict[str, Any] = {
            "model": model,
            "language_code": language,
            "mode": mode,
            **kwargs,
        }

        try:
            response = self._client.post(
                url,
                headers=headers,
                files=files,
                data=data,
            )
            return self._handle_response(response)
        except httpx.TimeoutException as exc:
            raise SarvamTimeoutError(f"Request to {url} timed out after {self.timeout}s") from exc
        except httpx.NetworkError as exc:
            raise SarvamConnectionError(f"Network error connecting to {self.base_url}: {str(exc)}") from exc

    def translate(
        self,
        text: str,
        source: str = "en-IN",
        target: str = "hi-IN",
        mode: str = "formal",
        model: str = "mayura:v1",
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Translate text across Indian languages and English via POST /translate.

        :param text: Input text to translate.
        :param source: Source language code (e.g. 'en-IN', 'hi-IN').
        :param target: Target language code (e.g. 'hi-IN', 'en-IN').
        :param mode: Translation mode ('formal', 'code-mixed').
        :param model: Translation model, defaults to 'mayura:v1'.
        :return: Dict containing request_id, translated_text, and source_language_code.
        """
        url = f"{self.base_url}/translate"
        headers = self._get_auth_headers()
        headers["Content-Type"] = "application/json"

        payload: Dict[str, Any] = {
            "input": text,
            "source_language_code": source,
            "target_language_code": target,
            "mode": mode,
            "model": model,
            **kwargs,
        }

        try:
            response = self._client.post(url, headers=headers, json=payload)
            return self._handle_response(response)
        except httpx.TimeoutException as exc:
            raise SarvamTimeoutError(f"Request to {url} timed out after {self.timeout}s") from exc
        except httpx.NetworkError as exc:
            raise SarvamConnectionError(f"Network error connecting to {self.base_url}: {str(exc)}") from exc

    def synthesize(
        self,
        text: Union[str, List[str]],
        language: str = "hi-IN",
        speaker: str = "shubh",
        model: str = "bulbul:v3",
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Convert text into spoken audio via POST /text-to-speech.

        :param text: Text string or list of text strings.
        :param language: Language code in BCP-47 format (e.g. 'hi-IN', 'en-IN').
        :param speaker: Speaker voice (e.g. 'shubh', 'priya', 'aditya').
        :param model: Speech synthesis model, defaults to 'bulbul:v3'.
        :return: Dict containing request_id and list of base64 audio strings in 'audios'.
        """
        url = f"{self.base_url}/text-to-speech"
        headers = self._get_auth_headers()
        headers["Content-Type"] = "application/json"

        payload: Dict[str, Any] = {
            "text": text,
            "language_code": language,
            "speaker": speaker,
            "model": model,
            **kwargs,
        }

        try:
            response = self._client.post(url, headers=headers, json=payload)
            return self._handle_response(response)
        except httpx.TimeoutException as exc:
            raise SarvamTimeoutError(f"Request to {url} timed out after {self.timeout}s") from exc
        except httpx.NetworkError as exc:
            raise SarvamConnectionError(f"Network error connecting to {self.base_url}: {str(exc)}") from exc

    def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "sarvam-105b",
        temperature: float = 0.2,
        endpoint: str = "/chat/completions",
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """
        Create a model response for a chat conversation via POST /chat/completions.
        Automatically falls back to /v1/chat/completions if the base route returns 404.

        :param messages: List of message objects with 'role' and 'content'.
        :param model: Model identifier, defaults to 'sarvam-105b'.
        :param temperature: Sampling temperature (0.0 to 2.0).
        :param endpoint: Endpoint path, defaults to '/chat/completions'.
        :return: Standard chat completion response object containing id, choices, and usage.
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = self._get_auth_headers()
        headers["Content-Type"] = "application/json"

        payload: Dict[str, Any] = {
            "messages": messages,
            "model": model,
            "temperature": temperature,
            **kwargs,
        }

        try:
            response = self._client.post(url, headers=headers, json=payload)
            # If /chat/completions returned 404, attempt fallback to /v1/chat/completions
            if response.status_code == 404 and endpoint != "/v1/chat/completions":
                fallback_url = f"{self.base_url}/v1/chat/completions"
                response = self._client.post(fallback_url, headers=headers, json=payload)
            return self._handle_response(response)
        except httpx.TimeoutException as exc:
            raise SarvamTimeoutError(f"Request to {url} timed out after {self.timeout}s") from exc
        except httpx.NetworkError as exc:
            raise SarvamConnectionError(f"Network error connecting to {self.base_url}: {str(exc)}") from exc

    def close(self) -> None:
        """Close the underlying HTTP client session."""
        if self._owns_client and hasattr(self._client, "close"):
            self._client.close()

    def __enter__(self) -> "SarvamClient":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.close()

    def __repr__(self) -> str:
        masked = "***" if self._api_key else "<not set>"
        return f"<SarvamClient base_url='{self.base_url}' api_key='{masked}' timeout={self.timeout}>"

    def __str__(self) -> str:
        return self.__repr__()
