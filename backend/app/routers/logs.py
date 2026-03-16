from datetime import datetime, timezone
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, joinedload

from app.db import get_db
from app.models import Log, LogEntity
from app.schemas import (
    LogCreate, 
    LogRead, 
    LogUpdate, 
    LogEntityCreate, 
    LogEntityRead, 
    LogEntityUpdate
)


router = APIRouter(prefix="/logs", tags=["logs"])


# --- LogEntity (기록 대상) 관련 API ---

@router.get("/entities", response_model=list[LogEntityRead])
def list_entities(
    user_id: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[LogEntity]:
    query = select(LogEntity)
    if user_id:
        query = query.where(LogEntity.user_id == user_id)
    if category:
        query = query.where(LogEntity.category == category)
    query = query.order_by(desc(LogEntity.updated_at)).limit(limit)
    return list(db.scalars(query).all())


@router.post("/entities", response_model=LogEntityRead, status_code=201)
def create_entity(payload: LogEntityCreate, db: Session = Depends(get_db)) -> LogEntity:
    # source_id가 있을 경우 중복 확인
    if payload.source_id:
        existing = db.execute(
            select(LogEntity).where(
                LogEntity.user_id == payload.user_id,
                LogEntity.source_id == payload.source_id
            )
        ).scalar_one_or_none()
        if existing:
            return existing

    entity = LogEntity(
        user_id=payload.user_id,
        category=payload.category,
        title=payload.title,
        source_id=payload.source_id,
        entity_metadata=payload.entity_metadata,
    )
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.patch("/entities/{entity_id}", response_model=LogEntityRead)
def update_entity(entity_id: UUID, payload: LogEntityUpdate, db: Session = Depends(get_db)) -> LogEntity:
    entity = db.get(LogEntity, entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="entity not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(entity, field, value)

    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


# --- Log (활동 히스토리) 관련 API ---

@router.get("", response_model=list[LogRead])
def list_logs(
    user_id: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    entity_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Log]:
    # entity 정보를 함께 가져오기 위해 joinedload 사용
    query = select(Log).options(joinedload(Log.entity))
    
    if user_id:
        query = query.where(Log.user_id == user_id)
    if category:
        query = query.where(Log.category == category)
    if entity_id:
        query = query.where(Log.entity_id == entity_id)
        
    # occurred_at 기준으로 내림차순 정렬 (최신 기록이 위로)
    query = query.order_by(desc(Log.occurred_at), desc(Log.created_at)).offset(offset).limit(limit)
    return list(db.scalars(query).all())


@router.post("", response_model=LogRead, status_code=201)
def create_log(payload: LogCreate, db: Session = Depends(get_db)) -> Log:
    # payload.occurred_at이 None이면 SQLAlchemy 모델의 default(lambda)가 자동으로 작동함
    log_data = payload.model_dump(exclude={"occurred_at"})
    if payload.occurred_at:
        log_data["occurred_at"] = payload.occurred_at

    log = Log(**log_data)
    
    # 엔티티가 있을 경우 엔티티의 updated_at 갱신 유도
    if payload.entity_id:
        entity = db.get(LogEntity, payload.entity_id)
        if entity:
            entity.updated_at = datetime.now(timezone.utc)
            db.add(entity)

    db.add(log)
    db.commit()
    db.refresh(log)
    
    # entity 정보를 로드하기 위해 다시 조회 (relationship 로딩 위해)
    stmt = select(Log).where(Log.id == log.id).options(joinedload(Log.entity))
    return db.scalar(stmt)


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
    
    stmt = select(Log).where(Log.id == log.id).options(joinedload(Log.entity))
    return db.scalar(stmt)


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(log_id: UUID, db: Session = Depends(get_db)) -> Response:
    log = db.get(Log, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="log not found")
    db.delete(log)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
