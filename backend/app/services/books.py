import html
import json
import re
import threading
import time
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.config import Settings
from app.schemas import BookEnrichmentResponse, BookProvider, BookSearchItem


class BookSearchError(Exception):
    pass


class BookSearchConfigError(BookSearchError):
    pass


_CACHE_LOCK = threading.Lock()
_SEARCH_CACHE: dict[tuple[str, int, str | None], tuple[float, list[BookSearchItem]]] = {}
_TAG_RE = re.compile(r"<[^>]+>")


def search_books(query: str, limit: int, provider: BookProvider | None, settings: Settings) -> list[BookSearchItem]:
    normalized_query = query.strip()
    if len(normalized_query) < 2:
        return []

    cache_key = (normalized_query.casefold(), limit, provider)
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    provider_entries = _build_provider_entries(provider, settings)
    if not provider_entries:
        raise BookSearchConfigError("책 검색 API 키가 설정되지 않았습니다.")

    items: list[BookSearchItem] = []
    seen_keys: set[str] = set()
    errors: list[str] = []

    for provider_name, loader in provider_entries:
        try:
            batch = loader(normalized_query, limit)
        except BookSearchError as error:
            errors.append(f"{provider_name}: {error}")
            continue

        for item in batch:
            dedupe_key = _build_dedupe_key(item)
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)
            items.append(item)
            if len(items) >= limit:
                _set_cached(cache_key, items[:limit], settings.book_search_cache_ttl_seconds)
                return items[:limit]

    if not items and errors:
        raise BookSearchError("; ".join(errors))

    _set_cached(cache_key, items[:limit], settings.book_search_cache_ttl_seconds)
    return items[:limit]


def enrich_book_by_isbn(isbn: str, settings: Settings) -> BookEnrichmentResponse:
    normalized_isbn = _normalize_isbn(isbn)
    if not normalized_isbn:
        raise BookSearchError("valid isbn is required")
    if not settings.nl_isbn_api_cert_key and not settings.google_books_api_key:
        raise BookSearchConfigError("도서 보강 API 키가 설정되지 않았습니다.")

    nl_result: BookEnrichmentResponse | None = None
    google_result: BookEnrichmentResponse | None = None

    if settings.nl_isbn_api_cert_key:
        try:
            nl_result = _enrich_with_nl_isbn_api(normalized_isbn, settings)
        except BookSearchError:
            nl_result = None

    if settings.google_books_api_key:
        try:
            google_result = _enrich_with_google_books(normalized_isbn, settings)
        except BookSearchError:
            google_result = None

    if nl_result and google_result:
        return _merge_enrichment(primary=nl_result, fallback=google_result)
    if nl_result:
        return nl_result
    if google_result:
        return google_result
    return BookEnrichmentResponse(source_provider="google_books", isbn=normalized_isbn, pages_total=None)


def _enrich_with_google_books(normalized_isbn: str, settings: Settings) -> BookEnrichmentResponse:
    payload = _request_json(
        "https://www.googleapis.com/books/v1/volumes",
        {
            "q": f"isbn:{normalized_isbn}",
            "maxResults": 5,
            "key": settings.google_books_api_key,
        },
        {},
        settings.book_search_timeout_seconds,
    )

    for item in payload.get("items", []):
        volume_info = item.get("volumeInfo", {})
        identifiers = volume_info.get("industryIdentifiers") or []
        codes = {
            _normalize_isbn(identifier.get("identifier"))
            for identifier in identifiers
            if _normalize_isbn(identifier.get("identifier"))
        }
        if normalized_isbn not in codes:
            continue

        authors = [author.strip() for author in volume_info.get("authors", []) if str(author).strip()]
        image_links = volume_info.get("imageLinks") or {}
        page_count = volume_info.get("pageCount")
        return BookEnrichmentResponse(
            source_provider="google_books",
            isbn=normalized_isbn,
            pages_total=int(page_count) if isinstance(page_count, int) and page_count > 0 else None,
            title=_clean_text(volume_info.get("title")) or None,
            authors=authors,
            publisher=_clean_text(volume_info.get("publisher")) or None,
            published_date=_format_date(volume_info.get("publishedDate")),
            description=_clean_text(volume_info.get("description")) or None,
            cover_url=image_links.get("thumbnail") or image_links.get("smallThumbnail") or None,
            source_metadata={
                "google_preview_link": volume_info.get("previewLink") or None,
                "google_info_link": volume_info.get("infoLink") or None,
                "google_print_type": volume_info.get("printType") or None,
                "google_language": volume_info.get("language") or None,
            },
        )

    return BookEnrichmentResponse(source_provider="google_books", isbn=normalized_isbn, pages_total=None)


def _enrich_with_nl_isbn_api(normalized_isbn: str, settings: Settings) -> BookEnrichmentResponse:
    payload = _request_json(
        "https://www.nl.go.kr/seoji/SearchApi.do",
        {
            "cert_key": settings.nl_isbn_api_cert_key,
            "result_style": "json",
            "page_no": 1,
            "page_size": 10,
            "isbn": normalized_isbn,
        },
        {},
        settings.book_search_timeout_seconds,
    )

    record = _extract_nl_record(payload, normalized_isbn)
    if record is None:
        return BookEnrichmentResponse(source_provider="nl_isbn", isbn=normalized_isbn, pages_total=None)

    title = _nl_value(record, "TITLE")
    author = _nl_value(record, "AUTHOR")
    publisher = _nl_value(record, "PUBLISHER")
    published_date = _format_date(_nl_value(record, "PUBLISH_PREDATE"))
    page_text = _nl_value(record, "PAGE")
    page_count = _parse_page_count(page_text)
    authors = [part for part in re.split(r"[;,/]| and ", author) if part.strip()] if author else []
    source_metadata = {
        "ea_isbn": _nl_value(record, "EA_ISBN") or None,
        "ea_add_code": _nl_value(record, "EA_ADD_CODE") or None,
        "set_isbn": _nl_value(record, "SET_ISBN") or None,
        "set_add_code": _nl_value(record, "SET_ADD_CODE") or None,
        "set_expression": _nl_value(record, "SET_EXPRESSION") or None,
        "ebook_yn": _normalize_yn(_nl_value(record, "EBOOK_YN")),
        "cip_yn": _normalize_yn(_nl_value(record, "CIP_YN")),
        "edition_statement": _nl_value(record, "EDITION_STMT") or None,
        "book_size": _nl_value(record, "BOOK_SIZE") or None,
        "form": _nl_value(record, "FORM") or None,
        "subject": _nl_value(record, "SUBJECT") or None,
        "control_no": _nl_value(record, "CONTROL_NO") or None,
        "title_url": _nl_value(record, "TITLE_URL") or None,
        "book_tb_cnt_url": _nl_value(record, "BOOK_TB_CNT_URL") or None,
        "book_introduction_url": _nl_value(record, "BOOK_INTRODUCTION_URL") or None,
        "book_summary_url": _nl_value(record, "BOOK_SUMMARY_URL") or None,
        "publisher_url": _nl_value(record, "PUBLISHER_URL") or None,
        "pre_price": _nl_value(record, "PRE_PRICE") or None,
    }
    clean_metadata = {key: value for key, value in source_metadata.items() if value not in (None, "", [])}
    return BookEnrichmentResponse(
        source_provider="nl_isbn",
        isbn=normalized_isbn,
        pages_total=page_count,
        title=title or None,
        authors=[item.strip() for item in authors if item.strip()],
        publisher=publisher or None,
        published_date=published_date,
        source_metadata=clean_metadata,
    )


def _merge_enrichment(primary: BookEnrichmentResponse, fallback: BookEnrichmentResponse) -> BookEnrichmentResponse:
    return BookEnrichmentResponse(
        source_provider=primary.source_provider,
        isbn=primary.isbn,
        pages_total=primary.pages_total or fallback.pages_total,
        title=primary.title or fallback.title,
        authors=primary.authors or fallback.authors,
        publisher=primary.publisher or fallback.publisher,
        published_date=primary.published_date or fallback.published_date,
        description=primary.description or fallback.description,
        cover_url=primary.cover_url or fallback.cover_url,
        source_metadata={**fallback.source_metadata, **primary.source_metadata},
    )


def _build_provider_entries(
    provider: BookProvider | None,
    settings: Settings,
) -> list[tuple[BookProvider, Callable[[str, int], list[BookSearchItem]]]]:
    entries: list[tuple[BookProvider, Callable[[str, int], list[BookSearchItem]]]] = []

    if provider in (None, "naver") and settings.naver_client_id and settings.naver_client_secret:
        entries.append(("naver", lambda query, limit: _search_naver(query, limit, settings)))
    elif provider == "naver":
        raise BookSearchConfigError("네이버 책 검색 API 키가 설정되지 않았습니다.")

    if provider in (None, "kakao") and settings.kakao_rest_api_key:
        entries.append(("kakao", lambda query, limit: _search_kakao(query, limit, settings)))
    elif provider == "kakao":
        raise BookSearchConfigError("카카오 책 검색 API 키가 설정되지 않았습니다.")

    return entries


def _search_naver(query: str, limit: int, settings: Settings) -> list[BookSearchItem]:
    payload = _request_json(
        "https://openapi.naver.com/v1/search/book.json",
        {"query": query, "display": min(limit, 10), "start": 1, "sort": "sim"},
        {
            "X-Naver-Client-Id": settings.naver_client_id,
            "X-Naver-Client-Secret": settings.naver_client_secret,
        },
        settings.book_search_timeout_seconds,
    )

    items: list[BookSearchItem] = []
    for item in payload.get("items", []):
        isbn, isbn13 = _split_isbns(item.get("isbn"))
        title = _clean_text(item.get("title"))
        author = _clean_text(item.get("author"))
        authors = [name for name in re.split(r"\|+", author) if name]
        source_id = isbn13 or isbn or item.get("link") or title
        items.append(
            BookSearchItem(
                source_provider="naver",
                source_id=f"naver:{source_id}",
                title=title,
                authors=authors,
                publisher=_clean_text(item.get("publisher")) or None,
                isbn=isbn,
                isbn13=isbn13,
                cover_url=item.get("image") or None,
                published_date=_format_date(item.get("pubdate")),
                description=_clean_text(item.get("description")) or None,
                pages_total=None,
                preview_link=item.get("link") or None,
            )
        )
    return items


def _search_kakao(query: str, limit: int, settings: Settings) -> list[BookSearchItem]:
    payload = _request_json(
        "https://dapi.kakao.com/v3/search/book",
        {"query": query, "size": min(limit, 10), "target": "title"},
        {"Authorization": f"KakaoAK {settings.kakao_rest_api_key}"},
        settings.book_search_timeout_seconds,
    )

    items: list[BookSearchItem] = []
    for item in payload.get("documents", []):
        isbn, isbn13 = _split_isbns(item.get("isbn"))
        title = _clean_text(item.get("title"))
        source_id = isbn13 or isbn or item.get("url") or title
        items.append(
            BookSearchItem(
                source_provider="kakao",
                source_id=f"kakao:{source_id}",
                title=title,
                authors=[_clean_text(author) for author in item.get("authors", []) if _clean_text(author)],
                publisher=_clean_text(item.get("publisher")) or None,
                isbn=isbn,
                isbn13=isbn13,
                cover_url=item.get("thumbnail") or None,
                published_date=_format_date(item.get("datetime")),
                description=_clean_text(item.get("contents")) or None,
                pages_total=None,
                preview_link=item.get("url") or None,
            )
        )
    return items


def _request_json(url: str, params: dict[str, object], headers: dict[str, str], timeout: float) -> dict:
    request = Request(f"{url}?{urlencode(params)}", headers=headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except HTTPError as error:
        try:
            detail = error.read().decode("utf-8", errors="ignore")
        except Exception:
            detail = ""
        raise BookSearchError(f"HTTP {error.code} {detail}".strip()) from error
    except URLError as error:
        raise BookSearchError(str(error.reason)) from error
    except TimeoutError as error:
        raise BookSearchError("timeout") from error


def _build_dedupe_key(item: BookSearchItem) -> str:
    return item.isbn13 or item.isbn or f"{item.title.casefold()}::{','.join(author.casefold() for author in item.authors)}"


def _extract_nl_record(payload: Any, normalized_isbn: str) -> dict[str, Any] | None:
    candidates: list[dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            keys = {str(key).upper() for key in node.keys()}
            if {"TITLE", "EA_ISBN", "SET_ISBN", "PAGE", "AUTHOR", "PUBLISHER"} & keys:
                candidates.append(node)
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)
    if not candidates:
        return None

    for candidate in candidates:
        candidate_ea_isbn = _normalize_isbn(_nl_value(candidate, "EA_ISBN"))
        candidate_set_isbn = _normalize_isbn(_nl_value(candidate, "SET_ISBN"))
        if normalized_isbn and normalized_isbn in {candidate_ea_isbn, candidate_set_isbn}:
            return candidate
    return candidates[0]


def _nl_value(record: dict[str, Any], field_name: str) -> str:
    target = field_name.upper()
    for key, value in record.items():
        if str(key).upper() != target:
            continue
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        return str(value).strip()
    return ""


def _clean_text(value: object) -> str:
    if not value:
        return ""
    text = html.unescape(str(value))
    text = _TAG_RE.sub("", text)
    return re.sub(r"\s+", " ", text).strip()


def _split_isbns(raw_value: object) -> tuple[str | None, str | None]:
    if not raw_value:
        return None, None
    candidates = re.findall(r"\d{10,13}", str(raw_value))
    isbn10 = next((code for code in candidates if len(code) == 10), None)
    isbn13 = next((code for code in candidates if len(code) == 13), None)
    primary = isbn13 or isbn10 or (candidates[0] if candidates else None)
    return primary, isbn13


def _format_date(raw_value: object) -> str | None:
    if not raw_value:
        return None
    text = str(raw_value).strip()
    if re.fullmatch(r"\d{8}", text):
        return f"{text[:4]}-{text[4:6]}-{text[6:8]}"
    if re.fullmatch(r"\d{4}", text):
        return f"{text}-01-01"
    if "T" in text:
        return text[:10]
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text
    return None


def _parse_page_count(raw_value: object) -> int | None:
    if not raw_value:
        return None
    match = re.search(r"(\d{1,5})", str(raw_value))
    if not match:
        return None
    value = int(match.group(1))
    return value if value > 0 else None


def _normalize_yn(raw_value: object) -> str | None:
    text = str(raw_value or "").strip().upper()
    return text if text in {"Y", "N"} else None


def _normalize_isbn(raw_value: object) -> str:
    if not raw_value:
        return ""
    return "".join(re.findall(r"[\dXx]", str(raw_value))).upper()


def _get_cached(key: tuple[str, int, str | None]) -> list[BookSearchItem] | None:
    now = time.time()
    with _CACHE_LOCK:
        cached = _SEARCH_CACHE.get(key)
        if not cached:
            return None
        expires_at, items = cached
        if expires_at <= now:
            _SEARCH_CACHE.pop(key, None)
            return None
        return items


def _set_cached(key: tuple[str, int, str | None], items: list[BookSearchItem], ttl_seconds: int) -> None:
    expires_at = time.time() + max(ttl_seconds, 1)
    with _CACHE_LOCK:
        _SEARCH_CACHE[key] = (expires_at, items)
