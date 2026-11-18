import pytest

from app.config import Settings
from app.services import media


@pytest.fixture(autouse=True)
def clear_cache():
    media._FEATURED_CACHE.clear()
    yield
    media._FEATURED_CACHE.clear()


def _settings(**overrides):
    values = {"tmdb_api_key": "key", "igdb_client_id": "", "igdb_client_secret": ""}
    values.update(overrides)
    return Settings(**values)


def test_featured_interleaves_films_and_series_and_skips_missing_posters(monkeypatch):
    def fake_request(url, params, headers, timeout):
        if url.endswith("/trending/movie/week"):
            return {"results": [
                {"id": 1, "title": "영화 하나", "poster_path": "/a.jpg"},
                {"id": 2, "title": "포스터 없음", "poster_path": None},
                {"id": 3, "title": "영화 둘", "poster_path": "/c.jpg"},
            ]}
        if url.endswith("/trending/tv/week"):
            return {"results": [{"id": 9, "name": "드라마 하나", "poster_path": "/t.jpg"}]}
        raise AssertionError(url)

    monkeypatch.setattr(media, "_request_json", fake_request)
    items = media.featured_media(_settings())

    assert [item.title for item in items] == ["영화 하나", "드라마 하나", "영화 둘"]
    assert [item.type for item in items] == ["movie", "series", "movie"]
    assert all(item.poster_url for item in items)


def test_featured_keeps_working_sources_when_one_fails(monkeypatch):
    def fake_request(url, params, headers, timeout):
        if url.endswith("/trending/movie/week"):
            raise media.MediaSearchError("down")
        return {"results": [{"id": 9, "name": "드라마 하나", "poster_path": "/t.jpg"}]}

    monkeypatch.setattr(media, "_request_json", fake_request)
    items = media.featured_media(_settings())
    assert [item.title for item in items] == ["드라마 하나"]


def test_featured_without_any_key_is_a_config_error():
    with pytest.raises(media.MediaSearchConfigError):
        media.featured_media(_settings(tmdb_api_key=""))


def test_featured_falls_back_to_plain_igdb_query(monkeypatch):
    bodies = []

    def fake_query(body, settings):
        bodies.append(body)
        if "hypes" in body:
            raise media.MediaSearchError("bad field")
        return [{"id": 5, "name": "게임", "cover": {"image_id": "abc"}, "first_release_date": 1_700_000_000}]

    monkeypatch.setattr(media, "_igdb_query", fake_query)
    items = media._recent_igdb_games(_settings(igdb_client_id="id", igdb_client_secret="secret"))
    assert len(bodies) == 2
    assert items[0].poster_url.endswith("/abc.jpg")
    assert items[0].type == "game"
