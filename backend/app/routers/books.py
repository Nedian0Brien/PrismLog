from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import Settings, get_settings
from app.schemas import BookEnrichmentResponse, BookProvider, BookSearchResponse
from app.services.books import BookSearchConfigError, BookSearchError, enrich_book_by_isbn, search_books


router = APIRouter(prefix="/books", tags=["books"])


@router.get("/search", response_model=BookSearchResponse)
def list_books(
    q: str = Query(min_length=1, max_length=120),
    limit: int = Query(default=6, ge=1, le=10),
    provider: BookProvider | None = Query(default=None),
    settings: Settings = Depends(get_settings),
) -> BookSearchResponse:
    try:
        items = search_books(query=q, limit=limit, provider=provider, settings=settings)
    except BookSearchConfigError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except BookSearchError as error:
        raise HTTPException(status_code=502, detail=f"book search unavailable: {error}") from error
    return BookSearchResponse(items=items)


@router.get("/enrich", response_model=BookEnrichmentResponse)
def enrich_book(
    isbn: str = Query(min_length=10, max_length=20),
    settings: Settings = Depends(get_settings),
) -> BookEnrichmentResponse:
    try:
        return enrich_book_by_isbn(isbn=isbn, settings=settings)
    except BookSearchConfigError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except BookSearchError as error:
        raise HTTPException(status_code=502, detail=f"book enrich unavailable: {error}") from error
