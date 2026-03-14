import json
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.config import Settings
from app.schemas import MediaEnrichResponse, MediaSearchItem


TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
TMDB_API_BASE = "https://api.themoviedb.org/3"
RAWG_API_BASE = "https://api.rawg.io/api"

_CACHE_LOCK = threading.Lock()
_SEARCH_CACHE: dict[tuple[str, str], tuple[float, list[MediaSearchItem]]] = {}


class MediaSearchError(Exception):
    pass


class MediaSearchConfigError(MediaSearchError):
    pass


def search_media(
    query: str,
    media_type: str,
    limit: int,
    settings: Settings,
) -> list[MediaSearchItem]:
    normalized = query.strip()
    if len(normalized) < 2:
        return []

    cache_key = (normalized.casefold(), media_type)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached[:limit]

    if media_type == "game":
        if not settings.rawg_api_key:
            raise MediaSearchConfigError("RAWG API 키가 설정되지 않았습니다.")
        items = _search_rawg_games(normalized, settings)
        _set_cached(cache_key, items, settings.media_search_cache_ttl_seconds)
        return items[:limit]

    if not settings.tmdb_api_key:
        raise MediaSearchConfigError("TMDB API 키가 설정되지 않았습니다.")

    items: list[MediaSearchItem] = []
    seen: set[str] = set()

    if media_type in ("movie", "all"):
        for item in _search_tmdb_movies(normalized, settings):
            if item.source_id not in seen:
                seen.add(item.source_id)
                items.append(item)

    if media_type in ("series", "all"):
        for item in _search_tmdb_tv(normalized, settings):
            if item.source_id not in seen:
                seen.add(item.source_id)
                items.append(item)

    _set_cached(cache_key, items, settings.media_search_cache_ttl_seconds)
    return items[:limit]


def enrich_media(
    media_type: str,
    settings: Settings,
    tmdb_id: int | None = None,
    rawg_id: int | None = None,
) -> MediaEnrichResponse:
    if media_type == "game":
        if not rawg_id:
            raise MediaSearchError("rawg_id is required for game enrichment")
        if not settings.rawg_api_key:
            raise MediaSearchConfigError("RAWG API 키가 설정되지 않았습니다.")
        return _enrich_rawg_game(rawg_id, settings)

    if not tmdb_id:
        raise MediaSearchError("tmdb_id is required for movie/series enrichment")
    if not settings.tmdb_api_key:
        raise MediaSearchConfigError("TMDB API 키가 설정되지 않았습니다.")
    return _enrich_tmdb_media(tmdb_id=tmdb_id, media_type=media_type, settings=settings)


def _enrich_tmdb_media(tmdb_id: int, media_type: str, settings: Settings) -> MediaEnrichResponse:
    if media_type == "series":
        payload = _request_json(
            f"{TMDB_API_BASE}/tv/{tmdb_id}",
            {"language": "ko-KR", "api_key": settings.tmdb_api_key},
            {},
            settings.media_search_timeout_seconds,
        )
        episode_count = payload.get("number_of_episodes")
        season_count = payload.get("number_of_seasons")
        runtimes = payload.get("episode_run_time") or []
        runtime = runtimes[0] if runtimes else None
        return MediaEnrichResponse(
            source_provider="tmdb",
            type="series",
            tmdb_id=tmdb_id,
            title=(payload.get("name") or "").strip() or None,
            original_title=(payload.get("original_name") or "").strip() or None,
            poster_url=f"{TMDB_IMAGE_BASE}{payload['poster_path']}" if payload.get("poster_path") else None,
            release_date=_format_date(payload.get("first_air_date")),
            overview=(payload.get("overview") or "").strip() or None,
            episode_count=int(episode_count) if isinstance(episode_count, int) and episode_count > 0 else None,
            season_count=int(season_count) if isinstance(season_count, int) and season_count > 0 else None,
            runtime=int(runtime) if isinstance(runtime, int) and runtime > 0 else None,
        )

    payload = _request_json(
        f"{TMDB_API_BASE}/movie/{tmdb_id}",
        {"language": "ko-KR", "api_key": settings.tmdb_api_key},
        {},
        settings.media_search_timeout_seconds,
    )
    runtime = payload.get("runtime")
    return MediaEnrichResponse(
        source_provider="tmdb",
        type="movie",
        tmdb_id=tmdb_id,
        title=(payload.get("title") or "").strip() or None,
        original_title=(payload.get("original_title") or "").strip() or None,
        poster_url=f"{TMDB_IMAGE_BASE}{payload['poster_path']}" if payload.get("poster_path") else None,
        release_date=_format_date(payload.get("release_date")),
        overview=(payload.get("overview") or "").strip() or None,
        runtime=int(runtime) if isinstance(runtime, int) and runtime > 0 else None,
    )


def _search_tmdb_movies(query: str, settings: Settings) -> list[MediaSearchItem]:
    payload = _request_json(
        f"{TMDB_API_BASE}/search/movie",
        {"query": query, "language": "ko-KR", "include_adult": "false", "page": 1, "api_key": settings.tmdb_api_key},
        {},
        settings.media_search_timeout_seconds,
    )
    items = []
    for r in payload.get("results", []):
        tmdb_id = r.get("id")
        if not tmdb_id:
            continue
        title = (r.get("title") or "").strip()
        if not title:
            continue
        items.append(MediaSearchItem(
            source_provider="tmdb",
            source_id=f"tmdb:movie:{tmdb_id}",
            tmdb_id=tmdb_id,
            type="movie",
            title=title,
            original_title=(r.get("original_title") or "").strip() or None,
            poster_url=f"{TMDB_IMAGE_BASE}{r['poster_path']}" if r.get("poster_path") else None,
            release_date=_format_date(r.get("release_date")),
            overview=(r.get("overview") or "").strip() or None,
        ))
    return items


def _search_tmdb_tv(query: str, settings: Settings) -> list[MediaSearchItem]:
    payload = _request_json(
        f"{TMDB_API_BASE}/search/tv",
        {"query": query, "language": "ko-KR", "include_adult": "false", "page": 1, "api_key": settings.tmdb_api_key},
        {},
        settings.media_search_timeout_seconds,
    )
    items = []
    for r in payload.get("results", []):
        tmdb_id = r.get("id")
        if not tmdb_id:
            continue
        title = (r.get("name") or "").strip()
        if not title:
            continue
        items.append(MediaSearchItem(
            source_provider="tmdb",
            source_id=f"tmdb:series:{tmdb_id}",
            tmdb_id=tmdb_id,
            type="series",
            title=title,
            original_title=(r.get("original_name") or "").strip() or None,
            poster_url=f"{TMDB_IMAGE_BASE}{r['poster_path']}" if r.get("poster_path") else None,
            release_date=_format_date(r.get("first_air_date")),
            overview=(r.get("overview") or "").strip() or None,
        ))
    return items


def _search_rawg_games(query: str, settings: Settings) -> list[MediaSearchItem]:
    payload = _request_json(
        f"{RAWG_API_BASE}/games",
        {
            "key": settings.rawg_api_key,
            "search": query,
            "page_size": 10,
            "search_precise": "true",
        },
        {},
        settings.media_search_timeout_seconds,
    )
    items = []
    for r in payload.get("results", []):
        rawg_id = r.get("id")
        title = (r.get("name") or "").strip()
        if not rawg_id or not title:
            continue
        original_title = (r.get("name_original") or "").strip() or None
        items.append(MediaSearchItem(
            source_provider="rawg",
            source_id=f"rawg:game:{rawg_id}",
            rawg_id=rawg_id,
            type="game",
            title=title,
            original_title=original_title if original_title != title else None,
            poster_url=(r.get("background_image") or "").strip() or None,
            release_date=_format_date(r.get("released")),
            overview=None,
        ))
    return items


def _enrich_rawg_game(rawg_id: int, settings: Settings) -> MediaEnrichResponse:
    payload = _request_json(
        f"{RAWG_API_BASE}/games/{rawg_id}",
        {"key": settings.rawg_api_key},
        {},
        settings.media_search_timeout_seconds,
    )
    title = (payload.get("name") or "").strip() or None
    original_title = (payload.get("name_original") or "").strip() or None
    description = _strip_html(payload.get("description_raw") or payload.get("description") or "")
    return MediaEnrichResponse(
        source_provider="rawg",
        type="game",
        rawg_id=rawg_id,
        title=title,
        original_title=original_title if original_title != title else None,
        poster_url=(payload.get("background_image") or "").strip() or None,
        release_date=_format_date(payload.get("released")),
        overview=description or None,
    )


def _request_json(url: str, params: dict, headers: dict, timeout: float) -> dict:
    request = Request(f"{url}?{urlencode(params)}", headers=headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except HTTPError as error:
        try:
            detail = error.read().decode("utf-8", errors="ignore")
        except Exception:
            detail = ""
        raise MediaSearchError(f"HTTP {error.code} {detail}".strip()) from error
    except URLError as error:
        raise MediaSearchError(str(error.reason)) from error
    except TimeoutError as error:
        raise MediaSearchError("timeout") from error


def _format_date(raw: object) -> str | None:
    if not raw:
        return None
    text = str(raw).strip()
    if len(text) >= 10 and text[4] == "-":
        return text[:10]
    return None


def _strip_html(raw: str) -> str:
    text = raw.replace("<br>", "\n").replace("<br />", "\n").replace("</p>", "\n")
    in_tag = False
    parts: list[str] = []
    for char in text:
        if char == "<":
            in_tag = True
            continue
        if char == ">":
            in_tag = False
            continue
        if not in_tag:
            parts.append(char)
    return " ".join("".join(parts).split())


def _get_cached(key: tuple[str, str]) -> list[MediaSearchItem] | None:
    now = time.time()
    with _CACHE_LOCK:
        entry = _SEARCH_CACHE.get(key)
        if not entry:
            return None
        expires_at, items = entry
        if expires_at <= now:
            _SEARCH_CACHE.pop(key, None)
            return None
        return items


def _set_cached(key: tuple[str, str], items: list[MediaSearchItem], ttl: int) -> None:
    expires_at = time.time() + max(ttl, 1)
    with _CACHE_LOCK:
        _SEARCH_CACHE[key] = (expires_at, items)
