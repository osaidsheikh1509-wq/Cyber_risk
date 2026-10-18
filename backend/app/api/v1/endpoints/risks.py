from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.risk import RiskItem
from app.schemas.risk import (
    RiskItemCreate,
    RiskItemUpdate,
    RiskItemResponse,
    RiskStatsResponse,
    MessageResponse,
    RiskSeverity,
    RiskStatus,
)

router = APIRouter()


@router.get("", response_model=List[RiskItemResponse], summary="List all risks")
def list_risks(
    severity: Optional[RiskSeverity] = Query(None, description="Filter by severity"),
    status: Optional[RiskStatus] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
) -> List[RiskItemResponse]:
    """Retrieve all tracked cyber risks with optional filters."""
    query = db.query(RiskItem)
    if severity:
        query = query.filter(RiskItem.severity == severity.value)
    if status:
        query = query.filter(RiskItem.status == status.value)
    return query.order_by(RiskItem.score.desc()).all()


@router.get("/stats", response_model=RiskStatsResponse, summary="Get risk metrics")
def get_risk_stats(db: Session = Depends(get_db)) -> RiskStatsResponse:
    """Get aggregated risk statistics for dashboard widgets."""
    risks = db.query(RiskItem).all()
    total = len(risks)
    critical = sum(1 for r in risks if r.severity == "critical")
    high = sum(1 for r in risks if r.severity == "high")
    medium = sum(1 for r in risks if r.severity == "medium")
    low = sum(1 for r in risks if r.severity == "low")
    open_count = sum(1 for r in risks if r.status == "open")
    mitigated_count = sum(1 for r in risks if r.status == "mitigated")
    avg_score = round(sum(r.score for r in risks) / total, 1) if total > 0 else 0.0

    return RiskStatsResponse(
        total_risks=total,
        critical=critical,
        high=high,
        medium=medium,
        low=low,
        open_count=open_count,
        mitigated_count=mitigated_count,
        average_score=avg_score,
    )


@router.post("", response_model=RiskItemResponse, status_code=status.HTTP_201_CREATED, summary="Create a new risk")
def create_risk(risk_in: RiskItemCreate, db: Session = Depends(get_db)) -> RiskItemResponse:
    """Register a new risk item."""
    db_item = RiskItem(
        title=risk_in.title,
        description=risk_in.description,
        severity=risk_in.severity.value,
        category=risk_in.category.value,
        status=risk_in.status.value,
        score=risk_in.score,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@router.get("/{risk_id}", response_model=RiskItemResponse, summary="Get single risk by ID")
def get_risk(risk_id: int, db: Session = Depends(get_db)) -> RiskItemResponse:
    """Retrieve details of a specific risk."""
    db_item = db.query(RiskItem).filter(RiskItem.id == risk_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail=f"Risk item {risk_id} not found")
    return db_item


@router.patch("/{risk_id}", response_model=RiskItemResponse, summary="Update risk")
def update_risk(risk_id: int, risk_in: RiskItemUpdate, db: Session = Depends(get_db)) -> RiskItemResponse:
    """Update fields of an existing risk item."""
    db_item = db.query(RiskItem).filter(RiskItem.id == risk_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail=f"Risk item {risk_id} not found")

    update_data = risk_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(value, "value"):
            setattr(db_item, field, value.value)
        else:
            setattr(db_item, field, value)

    db.commit()
    db.refresh(db_item)
    return db_item


@router.delete("/{risk_id}", response_model=MessageResponse, summary="Delete a risk")
def delete_risk(risk_id: int, db: Session = Depends(get_db)) -> MessageResponse:
    """Remove a risk item from the registry."""
    db_item = db.query(RiskItem).filter(RiskItem.id == risk_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail=f"Risk item {risk_id} not found")
    db.delete(db_item)
    db.commit()
    return MessageResponse(message=f"Risk item {risk_id} successfully deleted")
