import threading
import base64
from typing import Dict, Optional, Tuple
from app.schemas.briefing import ThreatBriefingResponse


def is_valid_audio_base64(audio_base64: Optional[str]) -> bool:
    """Validate that audio base64 is non-empty and decodes to > 100 bytes of valid audio data."""
    if not audio_base64 or not isinstance(audio_base64, str):
        return False
    try:
        decoded = base64.b64decode(audio_base64, validate=True)
        # Empty WAV headers are ~44 bytes. Valid TTS speech audio must exceed 100 bytes.
        return len(decoded) > 100
    except Exception:
        return False


class BriefingCache:
    """Thread-safe in-memory cache for audio briefings to avoid re-generating TTS and consuming credits."""

    def __init__(self, max_entries: int = 500):
        self._cache: Dict[Tuple[int, str], ThreatBriefingResponse] = {}
        self._lock = threading.Lock()
        self._max_entries = max_entries

    def get(self, threat_id: int, language_code: str) -> Optional[ThreatBriefingResponse]:
        key = (threat_id, language_code.strip().lower())
        with self._lock:
            cached = self._cache.get(key)
            if cached:
                # Extra validation: if cached audio is empty or invalid, purge immediately
                if not is_valid_audio_base64(cached.audio_base64):
                    del self._cache[key]
                    return None
                return ThreatBriefingResponse(
                    threat_id=cached.threat_id,
                    language_code=cached.language_code,
                    original_english=cached.original_english,
                    briefing_text=cached.briefing_text,
                    audio_base64=cached.audio_base64,
                    cached=True,
                )
            return None

    def set(self, threat_id: int, language_code: str, response: ThreatBriefingResponse) -> bool:
        """
        Only cache a briefing when the audio is non-empty and valid (>100 bytes).
        Never cache failures or empty audio.
        Returns True if cached, False otherwise.
        """
        if not is_valid_audio_base64(response.audio_base64):
            return False

        key = (threat_id, language_code.strip().lower())
        with self._lock:
            if len(self._cache) >= self._max_entries:
                # Evict oldest entry
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
            self._cache[key] = response
            return True

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def invalidate_threat(self, threat_id: int) -> None:
        with self._lock:
            keys_to_del = [k for k in self._cache if k[0] == threat_id]
            for k in keys_to_del:
                del self._cache[k]


# Singleton instance, explicitly cleared on initialization to flush any stale entries
briefing_cache = BriefingCache()
briefing_cache.clear()
