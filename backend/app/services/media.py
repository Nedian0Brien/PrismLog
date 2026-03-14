import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.config import Settings
from app.schemas import MediaEnrichResponse, MediaEpisodeInfo, MediaSeasonInfo, MediaSearchItem, MediaType


TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
TMDB_API_BASE = "https://api.themoviedb.org/3"
IGDB_API_BASE = "https://api.igdb.com/v4"
IGDB_IMAGE_BASE = "https://images.igdb.com/igdb/image/upload/t_cover_big"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"

_CACHE_LOCK = threading.Lock()
_SEARCH_CACHE: dict[tuple[str, str], tuple[float, list[MediaSearchItem]]] = {}

_TOKEN_LOCK = threading.Lock()
_IGDB_TOKEN: dict[str, object] = {}


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
        if not settings.igdb_client_id or not settings.igdb_client_secret:
            raise MediaSearchConfigError("IGDB 자격 증명이 설정되지 않았습니다.")
        items = _search_igdb_games(normalized, settings)
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


def enrich_media_by_tmdb_id(tmdb_id: int, media_type: str, settings: Settings) -> MediaEnrichResponse:
    if not settings.tmdb_api_key:
        raise MediaSearchConfigError("TMDB API 키가 설정되지 않았습니다.")

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
        seasons = _build_tmdb_season_details(tmdb_id, payload.get("seasons", []), settings)
        return MediaEnrichResponse(
            source_provider="tmdb",
            type="series",
            tmdb_id=tmdb_id,
            episode_count=int(episode_count) if isinstance(episode_count, int) and episode_count > 0 else None,
            season_count=int(season_count) if isinstance(season_count, int) and season_count > 0 else None,
            runtime=int(runtime) if isinstance(runtime, int) and runtime > 0 else None,
            seasons=seasons,
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


def _build_tmdb_season_details(tmdb_id: int, raw_seasons: object, settings: Settings) -> list[MediaSeasonInfo]:
    if not isinstance(raw_seasons, list):
        return []

    season_entries: list[dict[str, object]] = []
    for raw_season in raw_seasons:
        if not isinstance(raw_season, dict):
            continue
        season_number = raw_season.get("season_number")
        if not isinstance(season_number, int) or season_number < 1:
            continue
        season_entries.append({
            "season_number": season_number,
            "name": (raw_season.get("name") or "").strip() or None,
            "air_date": _format_date(raw_season.get("air_date")),
            "episode_count": raw_season.get("episode_count"),
            "overview": (raw_season.get("overview") or "").strip() or None,
            "poster_url": f"{TMDB_IMAGE_BASE}{raw_season['poster_path']}" if raw_season.get("poster_path") else None,
        })

    if not season_entries:
        return []

    details_by_season: dict[int, dict] = {}
    max_workers = min(4, len(season_entries))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(_fetch_tmdb_season_detail, tmdb_id, int(entry["season_number"]), settings): int(entry["season_number"])
            for entry in season_entries
        }
        for future in as_completed(future_map):
            season_number = future_map[future]
            try:
                details_by_season[season_number] = future.result()
            except MediaSearchError:
                continue

    seasons: list[MediaSeasonInfo] = []
    for entry in season_entries:
        season_number = int(entry["season_number"])
        detail = details_by_season.get(season_number, {})
        raw_episodes = detail.get("episodes", []) if isinstance(detail, dict) else []
        episodes = _build_tmdb_episode_details(raw_episodes, season_number)
        season_episode_count = entry["episode_count"]
        if not isinstance(season_episode_count, int) or season_episode_count <= 0:
            season_episode_count = len(episodes) or None
        seasons.append(MediaSeasonInfo(
            season_number=season_number,
            name=(detail.get("name") or entry["name"]) if isinstance(detail, dict) else entry["name"],
            air_date=_format_date(detail.get("air_date")) if isinstance(detail, dict) and detail.get("air_date") else entry["air_date"],
            episode_count=season_episode_count if isinstance(season_episode_count, int) and season_episode_count > 0 else None,
            overview=((detail.get("overview") or entry["overview"]) if isinstance(detail, dict) else entry["overview"]),
            poster_url=(
                f"{TMDB_IMAGE_BASE}{detail['poster_path']}"
                if isinstance(detail, dict) and detail.get("poster_path")
                else entry["poster_url"]
            ),
            episodes=episodes,
        ))

    return seasons


def _fetch_tmdb_season_detail(tmdb_id: int, season_number: int, settings: Settings) -> dict:
    return _request_json(
        f"{TMDB_API_BASE}/tv/{tmdb_id}/season/{season_number}",
        {"language": "ko-KR", "api_key": settings.tmdb_api_key},
        {},
        settings.media_search_timeout_seconds,
    )


def _build_tmdb_episode_details(raw_episodes: object, season_number: int) -> list[MediaEpisodeInfo]:
    if not isinstance(raw_episodes, list):
        return []

    episodes: list[MediaEpisodeInfo] = []
    for raw_episode in raw_episodes:
        if not isinstance(raw_episode, dict):
            continue
        episode_number = raw_episode.get("episode_number")
        if not isinstance(episode_number, int) or episode_number < 1:
            continue
        runtime = raw_episode.get("runtime")
        episodes.append(MediaEpisodeInfo(
            season_number=season_number,
            episode_number=episode_number,
            name=(raw_episode.get("name") or "").strip() or None,
            air_date=_format_date(raw_episode.get("air_date")),
            runtime=int(runtime) if isinstance(runtime, int) and runtime > 0 else None,
            overview=(raw_episode.get("overview") or "").strip() or None,
            still_url=f"{TMDB_IMAGE_BASE}{raw_episode['still_path']}" if raw_episode.get("still_path") else None,
        ))
    return episodes


def _get_igdb_token(settings: Settings) -> str:
    with _TOKEN_LOCK:
        entry = _IGDB_TOKEN
        if entry.get("token") and float(entry.get("expires_at", 0)) > time.time() + 60:
            return str(entry["token"])

    body = urlencode({
        "client_id": settings.igdb_client_id,
        "client_secret": settings.igdb_client_secret,
        "grant_type": "client_credentials",
    }).encode("utf-8")
    request = Request(
        TWITCH_TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urlopen(request, timeout=settings.media_search_timeout_seconds) as resp:
            data = json.load(resp)
    except (HTTPError, URLError) as error:
        raise MediaSearchError(f"IGDB 인증 실패: {error}") from error

    token = data.get("access_token", "")
    expires_in = data.get("expires_in", 3600)
    with _TOKEN_LOCK:
        _IGDB_TOKEN["token"] = token
        _IGDB_TOKEN["expires_at"] = time.time() + expires_in

    return token


def _is_korean(text: str) -> bool:
    if not text:
        return False
    for char in text:
        if "\uac00" <= char <= "\ud7a3" or "\u3130" <= char <= "\u318f":
            return True
    return False


def _search_igdb_games(query: str, settings: Settings) -> list[MediaSearchItem]:
    token = _get_igdb_token(settings)
    body = (
        f'fields name, cover.image_id, first_release_date, summary, slug, '
        f'alternative_names.name, alternative_names.comment; '
        f'search "{query}"; limit 10;'
    )
    request = Request(
        f"{IGDB_API_BASE}/games",
        data=body.encode("utf-8"),
        headers={
            "Client-ID": settings.igdb_client_id,
            "Authorization": f"Bearer {token}",
            "Content-Type": "text/plain",
        },
    )
    try:
        with urlopen(request, timeout=settings.media_search_timeout_seconds) as resp:
            results = json.load(resp)
    except (HTTPError, URLError) as error:
        raise MediaSearchError(f"IGDB 검색 실패: {error}") from error

    items = []
    for r in results:
        igdb_id = r.get("id")
        raw_name = (r.get("name") or "").strip()
        if not igdb_id or not raw_name:
            continue

        title = raw_name
        original_title = raw_name

        if not _is_korean(raw_name):
            alt_names = r.get("alternative_names", [])
            for alt in alt_names:
                alt_name = alt.get("name", "").strip()
                if _is_korean(alt_name):
                    title = alt_name
                    break

        cover = r.get("cover") or {}
        image_id = cover.get("image_id") if isinstance(cover, dict) else None
        poster_url = f"{IGDB_IMAGE_BASE}/{image_id}.jpg" if image_id else None
        release_ts = r.get("first_release_date")
        release_date = None
        if isinstance(release_ts, int):
            import datetime
            dt = datetime.datetime.fromtimestamp(release_ts, datetime.timezone.utc)
            release_date = dt.strftime("%Y-%m-%d")

        items.append(MediaSearchItem(
            source_provider="igdb",
            source_id=f"igdb:game:{igdb_id}",
            igdb_id=igdb_id,
            type="game",
            title=title,
            original_title=original_title if title != original_title else None,
            poster_url=poster_url,
            release_date=release_date,
            overview=(r.get("summary") or "").strip() or None,
        ))
    return items


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
