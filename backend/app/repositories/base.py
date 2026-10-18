from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


class ThreatRepository(ABC):
    """Abstract interface for threat registry database operations."""

    @abstractmethod
    def list(
        self,
        category: Optional[str] = None,
        risk_level: Optional[str] = None,
        status: Optional[str] = None,
        affected_asset: Optional[str] = None,
        min_score: Optional[int] = None,
        max_score: Optional[int] = None,
        search: Optional[str] = None,
        q: Optional[str] = None,
        sort_by: Optional[str] = "highest_risk",
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Return a page of threats matching filters along with the total matched count."""
        pass

    @abstractmethod
    def get_by_id(self, threat_id: str | int) -> Optional[Dict[str, Any]]:
        """Retrieve a single threat by its ID (int for SQLite or string ObjectId for Mongo)."""
        pass

    @abstractmethod
    def create(self, threat_data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a new threat and return the saved record with its ID."""
        pass

    @abstractmethod
    def update(self, threat_id: str | int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update threat fields and return the updated record."""
        pass

    @abstractmethod
    def delete(self, threat_id: str | int) -> bool:
        """Delete a threat by ID. Returns True if found and deleted, False otherwise."""
        pass

    @abstractmethod
    def count(self) -> int:
        """Total number of threats registered in database."""
        pass

    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        """Compute aggregated statistics (counts by level, status, category, avg score, 30d trend)."""
        pass


class TimelineRepository(ABC):
    """Abstract interface for threat audit timeline logging."""

    @abstractmethod
    def list_by_threat(self, threat_id: str | int) -> List[Dict[str, Any]]:
        """Return all chronological timeline events for a given threat."""
        pass

    @abstractmethod
    def create(
        self,
        threat_id: str | int,
        event_type: str,
        description: str,
        created_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Record a new timeline audit event."""
        pass

    @abstractmethod
    def delete_by_threat(self, threat_id: str | int) -> int:
        """Delete all timeline events for a given threat. Returns count deleted."""
        pass


class BriefingCacheRepository(ABC):
    """Abstract interface for multilingual briefing caching."""

    @abstractmethod
    def get(self, threat_id: str | int, lang: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached briefing if present."""
        pass

    @abstractmethod
    def set(self, threat_id: str | int, lang: str, data: Dict[str, Any]) -> bool:
        """Cache briefing. Returns True if cached successfully."""
        pass

    @abstractmethod
    def invalidate_threat(self, threat_id: str | int) -> None:
        """Invalidate all cached briefings for a specific threat."""
        pass

    @abstractmethod
    def clear(self) -> None:
        """Flush the cache."""
        pass
