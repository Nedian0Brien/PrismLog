from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PrismLog API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://prismlog:prismlog_change_me@localhost:5433/prismlog"
    cors_origins: str = "http://localhost:5173"
    book_search_timeout_seconds: float = 3.0
    book_search_cache_ttl_seconds: int = 300
    naver_client_id: str = ""
    naver_client_secret: str = ""
    kakao_rest_api_key: str = ""
    google_books_api_key: str = ""
    nl_isbn_api_cert_key: str = ""
    tmdb_api_key: str = ""
    media_search_timeout_seconds: float = 3.0
    media_search_cache_ttl_seconds: int = 300
    igdb_client_id: str = ""
    igdb_client_secret: str = ""
    upload_dir: str = "/home/ubuntu/project/PrismLog/uploads"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
