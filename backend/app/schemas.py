import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# 카테고리 확장: 독서, 공부, 문화, 영화, 시리즈, 게임 등
Category = Literal["reading", "study", "culture", "movie", "series", "game"]


class LogEntityBase(BaseModel):
    category: Category
    title: str = Field(min_length=1, max_length=255)
    source_id: Optional[str] = None
    entity_metadata: dict[str, Any] = Field(default_factory=dict)


class LogEntityCreate(LogEntityBase):
    user_id: str = Field(min_length=1, max_length=64)


class LogEntityUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    entity_metadata: Optional[dict[str, Any]] = None


class LogEntityRead(LogEntityBase):
    id: uuid.UUID
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LogCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    category: Category
    entity_id: Optional[uuid.UUID] = None  # 연결된 엔티티 ID
    title: Optional[str] = Field(default=None, max_length=255)
    summary: str = ""
    tags: list[str] = Field(default_factory=list)
    payload: dict[str, Any] = Field(default_factory=dict)
    occurred_at: Optional[datetime] = None  # 활동 발생 시각 (미지정 시 서버 시간)


class LogUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    summary: Optional[str] = None
    tags: Optional[list[str]] = None
    payload: Optional[dict[str, Any]] = None
    occurred_at: Optional[datetime] = None


class LogRead(BaseModel):
    id: uuid.UUID
    user_id: str
    category: Category
    entity_id: Optional[uuid.UUID]
    title: Optional[str]
    summary: str
    tags: list[str]
    payload: dict[str, Any]
    occurred_at: datetime
    created_at: datetime
    updated_at: datetime
    
    # 선택적으로 포함될 엔티티 정보
    entity: Optional[LogEntityRead] = None

    model_config = {"from_attributes": True}


# --- 기존 도서/미디어 검색 스키마 유지 ---

BookProvider = Literal["naver", "kakao"]

class BookSearchItem(BaseModel):
    source_provider: BookProvider
    source_id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    publisher: Optional[str] = None
    isbn: Optional[str] = None
    isbn13: Optional[str] = None
    cover_url: Optional[str] = None
    published_date: Optional[str] = None
    description: Optional[str] = None
    pages_total: Optional[int] = None
    preview_link: Optional[str] = None

class BookSearchResponse(BaseModel):
    items: list[BookSearchItem] = Field(default_factory=list)

MediaType = Literal["movie", "series", "game"]

class MediaSearchItem(BaseModel):
    source_provider: Literal["tmdb", "igdb"]
    source_id: str
    tmdb_id: Optional[int] = None
    igdb_id: Optional[int] = None
    type: MediaType
    title: str
    original_title: Optional[str] = None
    poster_url: Optional[str] = None
    release_date: Optional[str] = None
    overview: Optional[str] = None
    episode_count: Optional[int] = None
    season_count: Optional[int] = None

class MediaSearchResponse(BaseModel):
    items: list[MediaSearchItem] = Field(default_factory=list)

class MediaEpisodeInfo(BaseModel):
    season_number: int
    episode_number: int
    name: Optional[str] = None
    air_date: Optional[str] = None
    runtime: Optional[int] = None
    overview: Optional[str] = None
    still_url: Optional[str] = None

class MediaSeasonInfo(BaseModel):
    season_number: int
    name: Optional[str] = None
    air_date: Optional[str] = None
    episode_count: Optional[int] = None
    overview: Optional[str] = None
    poster_url: Optional[str] = None
    episodes: list[MediaEpisodeInfo] = Field(default_factory=list)

class MediaEnrichResponse(BaseModel):
    source_provider: Literal["tmdb"]
    type: MediaType
    tmdb_id: int
    episode_count: Optional[int] = None
    season_count: Optional[int] = None
    runtime: Optional[int] = None
    seasons: list[MediaSeasonInfo] = Field(default_factory=list)

class BookEnrichmentResponse(BaseModel):
    source_provider: Literal["google_books", "nl_isbn"]
    isbn: str
    pages_total: Optional[int] = None
    title: Optional[str] = None
    authors: list[str] = Field(default_factory=list)
    publisher: Optional[str] = None
    published_date: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    source_metadata: dict[str, Any] = Field(default_factory=dict)
