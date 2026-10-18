from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.risk_calculator import calculate_risk
from app.models.threat import Threat, TimelineEvent
from app.repositories.base import ThreatRepository, TimelineRepository, BriefingCacheRepository
from app.services.briefing_cache import briefing_cache


def _threat_to_dict(t: Threat) -> Dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "category": t.category,
        "likelihood": t.likelihood,
        "impact": t.impact,
        "risk_score": t.risk_score,
        "risk_level": t.risk_level,
        "status": t.status,
        "affected_asset": t.affected_asset,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


def _timeline_to_dict(e: TimelineEvent) -> Dict[str, Any]:
    return {
        "id": e.id,
        "threat_id": e.threat_id,
        "event_type": e.event_type,
        "description": e.description,
        "created_at": e.created_at,
        "timestamp": e.created_at,
    }


class SQLiteThreatRepository(ThreatRepository):
    def __init__(self, db: Session):
        self.db = db

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
        query = self.db.query(Threat)

        if category and category != "All":
            query = query.filter(Threat.category == category)
        if risk_level and risk_level != "All":
            query = query.filter(Threat.risk_level == risk_level)
        if status and status != "All":
            query = query.filter(Threat.status == status)
        if affected_asset:
            query = query.filter(Threat.affected_asset.ilike(f"%{affected_asset}%"))
        if min_score is not None:
            query = query.filter(Threat.risk_score >= min_score)
        if max_score is not None:
            query = query.filter(Threat.risk_score <= max_score)

        search_term = (q or search or "").strip()
        if search_term:
            search_fmt = f"%{search_term}%"
            query = query.filter(or_(Threat.title.ilike(search_fmt), Threat.description.ilike(search_fmt)))

        total_count = query.count()

        # Sorting
        if sort_by == "newest":
            query = query.order_by(Threat.created_at.desc())
        elif sort_by == "lowest_risk":
            query = query.order_by(Threat.risk_score.asc(), Threat.created_at.desc())
        elif sort_by == "oldest":
            query = query.order_by(Threat.created_at.asc())
        else:
            # Default highest_risk
            query = query.order_by(Threat.risk_score.desc(), Threat.created_at.desc())

        threats = query.offset(skip).limit(limit).all()
        return [_threat_to_dict(t) for t in threats], total_count

    def get_by_id(self, threat_id: str | int) -> Optional[Dict[str, Any]]:
        try:
            tid = int(threat_id)
        except (ValueError, TypeError):
            return None
        t = self.db.query(Threat).filter(Threat.id == tid).first()
        return _threat_to_dict(t) if t else None

    def create(self, threat_data: Dict[str, Any]) -> Dict[str, Any]:
        likelihood = threat_data["likelihood"]
        impact = threat_data["impact"]
        score, level = calculate_risk(likelihood, impact)

        created_at = threat_data.get("created_at") or datetime.now(timezone.utc)
        updated_at = threat_data.get("updated_at") or created_at

        db_threat = Threat(
            title=threat_data["title"],
            description=threat_data["description"],
            category=threat_data["category"],
            likelihood=likelihood,
            impact=impact,
            risk_score=score,
            risk_level=level,
            status=threat_data.get("status", "Open"),
            affected_asset=threat_data["affected_asset"],
            created_at=created_at,
            updated_at=updated_at,
        )
        self.db.add(db_threat)
        self.db.commit()
        self.db.refresh(db_threat)
        return _threat_to_dict(db_threat)

    def update(self, threat_id: str | int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            tid = int(threat_id)
        except (ValueError, TypeError):
            return None

        db_threat = self.db.query(Threat).filter(Threat.id == tid).first()
        if not db_threat:
            return None

        for field, value in update_data.items():
            if hasattr(db_threat, field) and field not in ("id", "risk_score", "risk_level"):
                setattr(db_threat, field, value)

        # Recalculate risk if likelihood or impact changed
        if "likelihood" in update_data or "impact" in update_data:
            new_score, new_level = calculate_risk(db_threat.likelihood, db_threat.impact)
            db_threat.risk_score = new_score
            db_threat.risk_level = new_level

        db_threat.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(db_threat)
        return _threat_to_dict(db_threat)

    def delete(self, threat_id: str | int) -> bool:
        try:
            tid = int(threat_id)
        except (ValueError, TypeError):
            return False

        db_threat = self.db.query(Threat).filter(Threat.id == tid).first()
        if not db_threat:
            return False

        self.db.delete(db_threat)
        self.db.commit()
        return True

    def count(self) -> int:
        return self.db.query(Threat).count()

    def get_stats(self) -> Dict[str, Any]:
        threats = self.db.query(Threat).all()
        total = len(threats)

        by_level: Dict[str, int] = {
            "Low": sum(1 for t in threats if t.risk_level == "Low"),
            "Medium": sum(1 for t in threats if t.risk_level == "Medium"),
            "High": sum(1 for t in threats if t.risk_level == "High"),
            "Critical": sum(1 for t in threats if t.risk_level == "Critical"),
        }

        by_status: Dict[str, int] = {
            "Open": sum(1 for t in threats if t.status == "Open"),
            "Investigating": sum(1 for t in threats if t.status == "Investigating"),
            "Mitigated": sum(1 for t in threats if t.status == "Mitigated"),
            "Closed": sum(1 for t in threats if t.status == "Closed"),
        }

        by_category: Dict[str, int] = {}
        for t in threats:
            by_category[t.category] = by_category.get(t.category, 0) + 1

        avg_score = round(sum(t.risk_score for t in threats) / total, 1) if total > 0 else 0.0

        now = datetime.now(timezone.utc)
        today = now.date()
        trend_30d: List[Dict[str, Any]] = []

        for day_offset in range(29, -1, -1):
            target_date = today - timedelta(days=day_offset)
            date_str = target_date.isoformat()

            threats_up_to_day = [
                t for t in threats
                if (t.created_at.date() if isinstance(t.created_at, datetime) else t.created_at) <= target_date
            ]
            threats_on_day = [
                t for t in threats
                if (t.created_at.date() if isinstance(t.created_at, datetime) else t.created_at) == target_date
            ]

            if threats_up_to_day:
                day_avg = round(sum(t.risk_score for t in threats_up_to_day) / len(threats_up_to_day), 1)
            elif threats:
                day_avg = avg_score
            else:
                day_avg = 0.0

            trend_30d.append({
                "date": date_str,
                "avg_score": day_avg,
                "threat_count": len(threats_on_day),
                "critical_count": sum(1 for t in threats_on_day if t.risk_level == "Critical"),
            })

        return {
            "total_threats": total,
            "by_level": by_level,
            "by_status": by_status,
            "by_category": by_category,
            "average_risk_score": avg_score,
            "trend_30d": trend_30d,
        }


class SQLiteTimelineRepository(TimelineRepository):
    def __init__(self, db: Session):
        self.db = db

    def list_by_threat(self, threat_id: str | int) -> List[Dict[str, Any]]:
        try:
            tid = int(threat_id)
        except (ValueError, TypeError):
            return []
        events = (
            self.db.query(TimelineEvent)
            .filter(TimelineEvent.threat_id == tid)
            .order_by(TimelineEvent.created_at.desc())
            .all()
        )
        return [_timeline_to_dict(e) for e in events]

    def create(
        self,
        threat_id: str | int,
        event_type: str,
        description: str,
        created_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        tid = int(threat_id)
        ev = TimelineEvent(
            threat_id=tid,
            event_type=event_type,
            description=description,
            created_at=created_at or datetime.now(timezone.utc),
        )
        self.db.add(ev)
        self.db.commit()
        self.db.refresh(ev)
        return _timeline_to_dict(ev)

    def delete_by_threat(self, threat_id: str | int) -> int:
        try:
            tid = int(threat_id)
        except (ValueError, TypeError):
            return 0
        deleted = (
            self.db.query(TimelineEvent)
            .filter(TimelineEvent.threat_id == tid)
            .delete()
        )
        self.db.commit()
        return deleted


class SQLiteBriefingCacheRepository(BriefingCacheRepository):
    def get(self, threat_id: str | int, lang: str) -> Optional[Dict[str, Any]]:
        try:
            tid = int(threat_id)
        except (ValueError, TypeError):
            tid = threat_id  # type: ignore
        res = briefing_cache.get(tid, lang)
        if res:
            return res.model_dump()
        return None

    def set(self, threat_id: str | int, lang: str, data: Dict[str, Any]) -> bool:
        from app.schemas.briefing import ThreatBriefingResponse
        try:
            tid = int(threat_id)
        except (ValueError, TypeError):
            tid = threat_id  # type: ignore
        model = ThreatBriefingResponse(**data)
        return briefing_cache.set(tid, lang, model)

    def invalidate_threat(self, threat_id: str | int) -> None:
        try:
            tid = int(threat_id)
        except (ValueError, TypeError):
            tid = threat_id  # type: ignore
        briefing_cache.invalidate_threat(tid)

    def clear(self) -> None:
        briefing_cache.clear()
