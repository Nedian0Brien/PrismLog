from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.services.seed import seed_dummy_data


router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/seed")
def seed(user_id: str = Query(default="demo-user"), db: Session = Depends(get_db)):
    settings = get_settings()
    if settings.app_env == "production":
        raise HTTPException(status_code=403, detail="seed endpoint is disabled in production")
    return seed_dummy_data(db=db, user_id=user_id)
