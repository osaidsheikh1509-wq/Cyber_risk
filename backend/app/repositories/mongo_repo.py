import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from pymongo.database import Database

from app.core.risk_calculator import calculate_risk
from app.repositories.base import ThreatRepository, TimelineRepository, BriefingCacheRepository
from app.services.briefing_cache import is_valid_audio_base64

logger = logging.getLogger(__name__)


def _to_object_id(val: str | int) -> Optional[ObjectId]:
    if isinstance(val, ObjectId):
        return val
    val_str = str(val).strip()
    if ObjectId.is_valid(val_str):
        try:
            return ObjectId(val_str)
        except Exception:
            return None
    return None


def _mongo_doc_to_threat(doc: Dict[str, Any]) -> Dict[str, Any]:
    threat_id = str(doc.get("_id", doc.get("id", "")))
    created_at = doc.get("created_at")
    if not isinstance(created_at, datetime):
        created_at = datetime.now(timezone.utc)
    updated_at = doc.get("updated_at")
    if not isinstance(updated_at, datetime):
        updated_at = created_at

    return {
        "id": threat_id,
        "title": doc.get("title", ""),
        "description": doc.get("description", ""),
        "category": doc.get("category", "Vulnerability"),
        "likelihood": int(doc.get("likelihood", 3)),
        "impact": int(doc.get("impact", 3)),
        "risk_score": int(doc.get("risk_score", 9)),
        "risk_level": doc.get("risk_level", "Medium"),
        "status": doc.get("status", "Open"),
        "affected_asset": doc.get("affected_asset", ""),
        "created_at": created_at,
        "updated_at": updated_at,
    }


def _mongo_doc_to_timeline(doc: Dict[str, Any]) -> Dict[str, Any]:
    event_id = str(doc.get("_id", doc.get("id", "")))
    threat_id = doc.get("threat_id", "")
    created_at = doc.get("created_at") or doc.get("timestamp")
    if not isinstance(created_at, datetime):
        created_at = datetime.now(timezone.utc)

    return {
        "id": event_id,
        "threat_id": threat_id,
        "event_type": doc.get("event_type", "NOTE"),
        "description": doc.get("description", ""),
        "created_at": created_at,
        "timestamp": created_at,
    }


class MongoThreatRepository(ThreatRepository):
    def __init__(self, db: Database):
        self.db = db
        self.col = db["threats"]

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
        query: Dict[str, Any] = {}

        if category and category != "All":
            query["category"] = category
        if risk_level and risk_level != "All":
            query["risk_level"] = risk_level
        if status and status != "All":
            query["status"] = status
        if affected_asset:
            query["affected_asset"] = {"$regex": re.escape(affected_asset), "$options": "i"}

        if min_score is not None or max_score is not None:
            score_filter: Dict[str, Any] = {}
            if min_score is not None:
                score_filter["$gte"] = min_score
            if max_score is not None:
                score_filter["$lte"] = max_score
            query["risk_score"] = score_filter

        search_term = (q or search or "").strip()
        if search_term:
            # First try text search, fall back to regex if text index is not supported
            query["$or"] = [
                {"title": {"$regex": re.escape(search_term), "$options": "i"}},
                {"description": {"$regex": re.escape(search_term), "$options": "i"}},
                {"affected_asset": {"$regex": re.escape(search_term), "$options": "i"}},
            ]

        total_count = self.col.count_documents(query)

        # Sorting
        if sort_by == "newest":
            sort_criteria = [("created_at", -1), ("_id", -1)]
        elif sort_by == "lowest_risk":
            sort_criteria = [("risk_score", 1), ("created_at", -1)]
        elif sort_by == "oldest":
            sort_criteria = [("created_at", 1)]
        else:
            # Default highest_risk
            sort_criteria = [("risk_score", -1), ("created_at", -1)]

        cursor = self.col.find(query).sort(sort_criteria).skip(skip).limit(limit)
        items = [_mongo_doc_to_threat(doc) for doc in cursor]
        return items, total_count

    def get_by_id(self, threat_id: str | int) -> Optional[Dict[str, Any]]:
        oid = _to_object_id(threat_id)
        if oid is not None:
            doc = self.col.find_one({"_id": oid})
            if doc:
                return _mongo_doc_to_threat(doc)

        # Fallback by string or int id
        str_id = str(threat_id)
        doc = self.col.find_one({"id": str_id})
        if not doc:
            try:
                doc = self.col.find_one({"id": int(threat_id)})
            except Exception:
                pass
        return _mongo_doc_to_threat(doc) if doc else None

    def create(self, threat_data: Dict[str, Any]) -> Dict[str, Any]:
        likelihood = threat_data["likelihood"]
        impact = threat_data["impact"]
        score, level = calculate_risk(likelihood, impact)

        created_at = threat_data.get("created_at") or datetime.now(timezone.utc)
        updated_at = threat_data.get("updated_at") or created_at

        doc = {
            "title": threat_data["title"],
            "description": threat_data["description"],
            "category": threat_data["category"],
            "likelihood": likelihood,
            "impact": impact,
            "risk_score": score,
            "risk_level": level,
            "status": threat_data.get("status", "Open"),
            "affected_asset": threat_data["affected_asset"],
            "created_at": created_at,
            "updated_at": updated_at,
        }
        res = self.col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return _mongo_doc_to_threat(doc)

    def update(self, threat_id: str | int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        oid = _to_object_id(threat_id)
        query = {"_id": oid} if oid is not None else {"id": str(threat_id)}

        existing = self.col.find_one(query)
        if not existing:
            return None

        # Build update fields
        set_fields: Dict[str, Any] = {}
        for field, value in update_data.items():
            if field not in ("id", "_id", "risk_score", "risk_level"):
                set_fields[field] = value

        new_likelihood = set_fields.get("likelihood", existing.get("likelihood", 3))
        new_impact = set_fields.get("impact", existing.get("impact", 3))
        if "likelihood" in update_data or "impact" in update_data:
            score, level = calculate_risk(new_likelihood, new_impact)
            set_fields["risk_score"] = score
            set_fields["risk_level"] = level

        set_fields["updated_at"] = datetime.now(timezone.utc)

        self.col.update_one(query, {"$set": set_fields})
        updated_doc = self.col.find_one(query)
        return _mongo_doc_to_threat(updated_doc) if updated_doc else None

    def delete(self, threat_id: str | int) -> bool:
        oid = _to_object_id(threat_id)
        query = {"_id": oid} if oid is not None else {"id": str(threat_id)}
        res = self.col.delete_one(query)
        return res.deleted_count > 0

    def count(self) -> int:
        return self.col.count_documents({})

    def get_stats(self) -> Dict[str, Any]:
        """
        Compute statistics using MongoDB aggregation pipelines:
          1. Level distribution pipeline
          2. Status distribution pipeline
          3. Category distribution pipeline
          4. 30-day posture trend pipeline
        """
        # Overall totals
        total = self.col.count_documents({})

        # 1. Pipeline by risk_level
        by_level: Dict[str, int] = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
        try:
            level_pipe = [{"$group": {"_id": "$risk_level", "count": {"$sum": 1}}}]
            for row in self.col.aggregate(level_pipe):
                lvl = row.get("_id")
                if lvl in by_level:
                    by_level[lvl] = row.get("count", 0)
        except Exception as exc:
            logger.warning("Level aggregation fallback: %s", exc)

        # 2. Pipeline by status
        by_status: Dict[str, int] = {"Open": 0, "Investigating": 0, "Mitigated": 0, "Closed": 0}
        try:
            status_pipe = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
            for row in self.col.aggregate(status_pipe):
                st = row.get("_id")
                if st in by_status:
                    by_status[st] = row.get("count", 0)
        except Exception as exc:
            logger.warning("Status aggregation fallback: %s", exc)

        # 3. Pipeline by category
        by_category: Dict[str, int] = {}
        try:
            cat_pipe = [{"$group": {"_id": "$category", "count": {"$sum": 1}}}]
            for row in self.col.aggregate(cat_pipe):
                cat = row.get("_id")
                if cat:
                    by_category[cat] = row.get("count", 0)
        except Exception as exc:
            logger.warning("Category aggregation fallback: %s", exc)

        # 4. Average risk score pipeline
        avg_score = 0.0
        try:
            avg_pipe = [{"$group": {"_id": None, "avg_score": {"$avg": "$risk_score"}}}]
            avg_rows = list(self.col.aggregate(avg_pipe))
            if avg_rows and avg_rows[0].get("avg_score") is not None:
                avg_score = round(float(avg_rows[0]["avg_score"]), 1)
        except Exception:
            pass

        # 5. 30-day trend
        now = datetime.now(timezone.utc)
        today = now.date()
        start_30d = today - timedelta(days=29)
        start_dt = datetime.combine(start_30d, datetime.min.time(), tzinfo=timezone.utc)

        # Pre-seed 30 days dictionary
        days_map: Dict[str, Dict[str, Any]] = {}
        for d in range(29, -1, -1):
            day_str = (today - timedelta(days=d)).isoformat()
            days_map[day_str] = {
                "date": day_str,
                "threat_count": 0,
                "critical_count": 0,
                "day_scores": [],
            }

        try:
            # Aggregation grouping by date string
            trend_pipe = [
                {"$match": {"created_at": {"$gte": start_dt}}},
                {
                    "$group": {
                        "_id": {
                            "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                        },
                        "threat_count": {"$sum": 1},
                        "critical_count": {
                            "$sum": {
                                "$cond": [{"$eq": ["$risk_level", "Critical"]}, 1, 0]
                            }
                        },
                        "scores": {"$push": "$risk_score"},
                    }
                },
            ]
            for row in self.col.aggregate(trend_pipe):
                date_key = row.get("_id")
                if date_key in days_map:
                    days_map[date_key]["threat_count"] = row.get("threat_count", 0)
                    days_map[date_key]["critical_count"] = row.get("critical_count", 0)
                    days_map[date_key]["day_scores"] = row.get("scores", [])
        except Exception as exc:
            logger.warning("Trend aggregation fallback: %s", exc)
            # In memory fallback if mongo aggregation fails
            all_threats = list(self.col.find({}))
            for t in all_threats:
                cat_dt = t.get("created_at")
                if isinstance(cat_dt, datetime):
                    d_str = cat_dt.date().isoformat()
                    if d_str in days_map:
                        days_map[d_str]["threat_count"] += 1
                        if t.get("risk_level") == "Critical":
                            days_map[d_str]["critical_count"] += 1
                        days_map[d_str]["day_scores"].append(t.get("risk_score", 0))

        # Build final 30-day trend with cumulative or day average
        trend_30d: List[Dict[str, Any]] = []
        for day_offset in range(29, -1, -1):
            date_str = (today - timedelta(days=day_offset)).isoformat()
            day_info = days_map.get(date_str, {"threat_count": 0, "critical_count": 0, "day_scores": []})
            scores = day_info.get("day_scores", [])
            day_avg = round(sum(scores) / len(scores), 1) if scores else avg_score

            trend_30d.append({
                "date": date_str,
                "avg_score": day_avg,
                "threat_count": day_info["threat_count"],
                "critical_count": day_info["critical_count"],
            })

        return {
            "total_threats": total,
            "by_level": by_level,
            "by_status": by_status,
            "by_category": by_category,
            "average_risk_score": avg_score,
            "trend_30d": trend_30d,
        }


class MongoTimelineRepository(TimelineRepository):
    def __init__(self, db: Database):
        self.db = db
        self.col = db["timeline_events"]

    def list_by_threat(self, threat_id: str | int) -> List[Dict[str, Any]]:
        str_id = str(threat_id)
        # Search matching threat_id as string or int
        query: Dict[str, Any] = {"$or": [{"threat_id": str_id}]}
        try:
            query["$or"].append({"threat_id": int(threat_id)})
        except Exception:
            pass

        cursor = self.col.find(query).sort([("created_at", -1), ("_id", -1)])
        return [_mongo_doc_to_timeline(doc) for doc in cursor]

    def create(
        self,
        threat_id: str | int,
        event_type: str,
        description: str,
        created_at: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        dt = created_at or datetime.now(timezone.utc)
        doc = {
            "threat_id": str(threat_id),
            "event_type": event_type,
            "description": description,
            "created_at": dt,
            "timestamp": dt,
        }
        res = self.col.insert_one(doc)
        doc["_id"] = res.inserted_id
        return _mongo_doc_to_timeline(doc)

    def delete_by_threat(self, threat_id: str | int) -> int:
        str_id = str(threat_id)
        query: Dict[str, Any] = {"$or": [{"threat_id": str_id}]}
        try:
            query["$or"].append({"threat_id": int(threat_id)})
        except Exception:
            pass
        res = self.col.delete_many(query)
        return res.deleted_count


class MongoBriefingCacheRepository(BriefingCacheRepository):
    def __init__(self, db: Database):
        self.db = db
        self.col = db["briefings"]

    def get(self, threat_id: str | int, lang: str) -> Optional[Dict[str, Any]]:
        key_lang = lang.strip().lower()
        str_id = str(threat_id)
        doc = self.col.find_one({"threat_id": str_id, "lang": key_lang})
        if not doc:
            try:
                doc = self.col.find_one({"threat_id": int(threat_id), "lang": key_lang})
            except Exception:
                pass

        if not doc:
            return None

        audio_b64 = doc.get("audio_base64", "")
        if not is_valid_audio_base64(audio_b64):
            self.col.delete_one({"_id": doc["_id"]})
            return None

        return {
            "threat_id": threat_id,
            "language_code": doc.get("language_code", lang),
            "original_english": doc.get("original_english", ""),
            "briefing_text": doc.get("briefing_text", ""),
            "audio_base64": audio_b64,
            "cached": True,
        }

    def set(self, threat_id: str | int, lang: str, data: Dict[str, Any]) -> bool:
        audio_b64 = data.get("audio_base64", "")
        if not is_valid_audio_base64(audio_b64):
            return False

        key_lang = lang.strip().lower()
        str_id = str(threat_id)
        doc = {
            "threat_id": str_id,
            "lang": key_lang,
            "language_code": data.get("language_code", lang),
            "original_english": data.get("original_english", ""),
            "briefing_text": data.get("briefing_text", ""),
            "audio_base64": audio_b64,
            "updated_at": datetime.now(timezone.utc),
        }
        self.col.update_one(
            {"threat_id": str_id, "lang": key_lang},
            {"$set": doc},
            upsert=True,
        )
        return True

    def invalidate_threat(self, threat_id: str | int) -> None:
        str_id = str(threat_id)
        query: Dict[str, Any] = {"$or": [{"threat_id": str_id}]}
        try:
            query["$or"].append({"threat_id": int(threat_id)})
        except Exception:
            pass
        self.col.delete_many(query)

    def clear(self) -> None:
        self.col.delete_many({})
