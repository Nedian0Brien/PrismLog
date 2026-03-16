import uuid
from datetime import datetime
from sqlalchemy import DateTime, String, Text, func, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class LogEntity(Base):
    """
    기록의 대상이 되는 엔티티 모델 (책, 시리즈, 영화, 공부 주제 등)
    """
    __tablename__ = "log_entities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    title: Mapped[str] = mapped_column(String(255))
    
    # 외부 API 식별자 (isbn, tmdb_id 등) - 중복 생성 방지용
    source_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    
    # 엔티티의 정적 메타데이터 (커버 이미지, 총 페이지 수, 감독 등)
    entity_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # 관계 설정: 하나의 엔티티는 여러 개의 로그(활동 히스토리)를 가질 수 있음
    logs: Mapped[list["Log"]] = relationship("Log", back_populates="entity", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "source_id", name="uq_user_entity_source"),
    )


class Log(Base):
    """
    실제 활동 기록 모델 (읽은 페이지, 시청한 에피소드, 공부 시간 등)
    타임라인의 각 항목을 나타냄
    """
    __tablename__ = "logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # 어떤 엔티티에 대한 기록인지 (nullable=True는 기존 데이터 호환성 위함)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("log_entities.id", ondelete="CASCADE"), index=True, nullable=True
    )
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    
    # 개별 기록의 제목 (엔티티 제목과 다를 경우 사용, 예: "1장 완료")
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    
    # 활동 상세 데이터 (진행도 변화량, 시청 에피소드 번호 등)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    # 실제 활동 발생 시간 (타임라인 정렬의 기준)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # 관계 설정
    entity: Mapped[LogEntity | None] = relationship("LogEntity", back_populates="logs")
