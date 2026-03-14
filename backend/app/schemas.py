import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


Category = Literal["reading", "study", "culture"]


class LogCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)
    category: Category
    title: str = Field(min_length=1, max_length=255)
    summary: str = ""
    tags: list[str] = Field(default_factory=list)
    payload: dict[str, Any] = Field(default_factory=dict)


class LogUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    summary: str | None = None
    tags: list[str] | None = None
    payload: dict[str, Any] | None = None


class LogRead(BaseModel):
    id: uuid.UUID
    user_id: str
    category: Category
    title: str
    summary: str
    tags: list[str]
    payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


BookProvider = Literal["naver", "kakao"]


class BookSearchItem(BaseModel):
    source_provider: BookProvider
    source_id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    publisher: str | None = None
    isbn: str | None = None
    isbn13: str | None = None
    cover_url: str | None = None
    published_date: str | None = None
    description: str | None = None
    pages_total: int | None = None
    preview_link: str | None = None


class BookSearchResponse(BaseModel):
    items: list[BookSearchItem] = Field(default_factory=list)


MediaType = Literal["movie", "series", "game"]


class MediaSearchItem(BaseModel):
    source_provider: Literal["tmdb", "rawg"]
    source_id: str
    tmdb_id: int | None = None
    rawg_id: int | None = None
    type: MediaType
    title: str
    original_title: str | None = None
    poster_url: str | None = None
    release_date: str | None = None
    overview: str | None = None
    episode_count: int | None = None
    season_count: int | None = None


class MediaSearchResponse(BaseModel):
    items: list[MediaSearchItem] = Field(default_factory=list)


class MediaEnrichResponse(BaseModel):
    source_provider: Literal["tmdb", "rawg"]
    type: MediaType
    tmdb_id: int | None = None
    rawg_id: int | None = None
    title: str | None = None
    original_title: str | None = None
    poster_url: str | None = None
    release_date: str | None = None
    overview: str | None = None
    episode_count: int | None = None
    season_count: int | None = None
    runtime: int | None = None


class BookEnrichmentResponse(BaseModel):
    source_provider: Literal["google_books", "nl_isbn"]
    isbn: str
    pages_total: int | None = None
    title: str | None = None
    authors: list[str] = Field(default_factory=list)
    publisher: str | None = None
    published_date: str | None = None
    description: str | None = None
    cover_url: str | None = None
    source_metadata: dict[str, Any] = Field(default_factory=dict)
