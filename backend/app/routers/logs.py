from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Log
from app.schemas import LogCreate, LogRead, LogUpdate


router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("", response_model=list[LogRead])
def list_logs(
    user_id: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Log]:
    query = select(Log)
    if user_id:
        query = query.where(Log.user_id == user_id)
    if category:
        query = query.where(Log.category == category)
    query = query.order_by(desc(Log.created_at)).offset(offset).limit(limit)
    return list(db.scalars(query).all())


@router.post("", response_model=LogRead, status_code=201)
def create_log(payload: LogCreate, db: Session = Depends(get_db)) -> Log:
    log = Log(
        user_id=payload.user_id,
        category=payload.category,
        title=payload.title,
        summary=payload.summary,
        tags=payload.tags,
        payload=payload.payload,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.patch("/{log_id}", response_model=LogRead)
def update_log(log_id: UUID, payload: LogUpdate, db: Session = Depends(get_db)) -> Log:
    log = db.get(Log, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="log not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(log, field, value)

    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(log_id: UUID, db: Session = Depends(get_db)) -> Response:
    log = db.get(Log, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="log not found")
    db.delete(log)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
