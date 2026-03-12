from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import Settings, get_settings
from app.schemas import MediaSearchResponse
from app.services.media import MediaSearchConfigError, MediaSearchError, search_media


router = APIRouter(prefix="/media", tags=["media"])


@router.get("/search", response_model=MediaSearchResponse)
def search_media_endpoint(
    q: str = Query(min_length=1, max_length=120),
    type: str = Query(default="all", pattern="^(movie|series|all)$"),
    limit: int = Query(default=6, ge=1, le=20),
    settings: Settings = Depends(get_settings),
) -> MediaSearchResponse:
    try:
        items = search_media(query=q, media_type=type, limit=limit, settings=settings)
    except MediaSearchConfigError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except MediaSearchError as error:
        raise HTTPException(status_code=502, detail=f"media search unavailable: {error}") from error
    return MediaSearchResponse(items=items)
