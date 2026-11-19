import pytest

from app.config import Settings
from app.services import books


@pytest.fixture(autouse=True)
def clear_cache():
    books._SEARCH_CACHE.clear()
    yield
    books._SEARCH_CACHE.clear()


def _settings(**overrides):
    values = {"kakao_rest_api_key": "", "google_books_api_key": ""}
    values.update(overrides)
    return Settings(**values)


KAKAO = {"documents": [
    {"title": "소년이 온다", "authors": ["한강"], "publisher": "창비", "isbn": "8936434128 9788936434120",
     "thumbnail": "https://k/1.jpg", "datetime": "2014-05-19T00:00:00.000+09:00", "url": "https://k/1"},
]}

GOOGLE = {"items": [
    {"id": "g1", "volumeInfo": {
        "title": "소년이 온다", "authors": ["한강"], "publishedDate": "2014-05",
        "industryIdentifiers": [{"type": "ISBN_13", "identifier": "9788936434120"}],
        "imageLinks": {"thumbnail": "http://g/1?id=x&img=1&edge=curl&source=gbs_api"}, "pageCount": 216}},
    {"id": "g2", "volumeInfo": {
        "title": "채식주의자", "authors": ["한강"], "publishedDate": "2007",
        "industryIdentifiers": [{"type": "ISBN_10", "identifier": "89-364-3354-5"}], "pageCount": 247}},
    {"id": "g3", "volumeInfo": {"authors": ["제목 없음"]}},
]}


def test_kakao_leads_and_google_fills_without_duplicates(monkeypatch):
    calls = []

    def fake_request(url, params, headers, timeout):
        calls.append((url, params))
        return KAKAO if "kakao" in url else GOOGLE

    monkeypatch.setattr(books, "_request_json", fake_request)
    items = books.search_books("한강", 6, None, _settings(kakao_rest_api_key="k", google_books_api_key="g"))

    assert [item.source_provider for item in items] == ["kakao", "google_books"]
    assert items[0].isbn13 == "9788936434120"
    assert items[1].title == "채식주의자"
    assert items[1].isbn == "8936433545"
    assert items[1].pages_total == 247
    assert items[1].published_date == "2007-01-01"
    # Kakao searches every field, so an author's name finds their books.
    assert "target" not in calls[0][1]


def test_google_alone_works_while_kakao_key_is_missing(monkeypatch):
    monkeypatch.setattr(books, "_request_json", lambda url, params, headers, timeout: GOOGLE)
    items = books.search_books("한강", 6, None, _settings(google_books_api_key="g"))

    assert [item.source_id for item in items] == ["google_books:9788936434120", "google_books:8936433545"]
    assert items[0].published_date == "2014-05-01"
    assert items[0].pages_total == 216
    # Google's http cover links come back over TLS, without the page curl.
    assert items[0].cover_url == "https://g/1?id=x&img=1&source=gbs_api"


def test_isbn_query_searches_by_isbn(monkeypatch):
    calls = []

    def fake_request(url, params, headers, timeout):
        calls.append(params)
        return {"documents": []} if "kakao" in url else {"items": []}

    monkeypatch.setattr(books, "_request_json", fake_request)
    books.search_books("978-89-364-3412-0", 6, None, _settings(kakao_rest_api_key="k", google_books_api_key="g"))

    assert calls[0]["target"] == "isbn"
    assert calls[0]["query"] == "9788936434120"
    assert calls[1]["q"] == "isbn:9788936434120"


def test_numbers_in_a_title_are_not_an_isbn():
    assert books._isbn_query("1984") is None
    assert books._isbn_query("2001 스페이스 오디세이") is None
    assert books._isbn_query("89364 33545") == "8936433545"


def test_kakao_failure_falls_back_to_google(monkeypatch):
    def fake_request(url, params, headers, timeout):
        if "kakao" in url:
            raise books.BookSearchError("HTTP 401")
        return GOOGLE

    monkeypatch.setattr(books, "_request_json", fake_request)
    items = books.search_books("한강", 6, None, _settings(kakao_rest_api_key="k", google_books_api_key="g"))
    assert len(items) == 2


def test_no_keys_is_a_config_error():
    with pytest.raises(books.BookSearchConfigError):
        books.search_books("한강", 6, None, _settings())


def test_old_naver_settings_in_env_are_ignored():
    settings = Settings(naver_client_id="old", kakao_rest_api_key="")
    assert not hasattr(settings, "naver_client_id")
