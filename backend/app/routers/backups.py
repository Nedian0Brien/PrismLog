from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.services.backups import (
    BackupResult,
    BackupUnavailableError,
    GoogleDriveBackupService,
    GoogleDriveClient,
)


router = APIRouter(prefix="/backups", tags=["backups"])


class BackupCreate(BaseModel):
    user_id: str = Field(min_length=1, max_length=64)


class BackupRead(BaseModel):
    file_id: str
    file_name: str
    web_view_link: str | None
    counts: dict[str, int]
    created_at: str


def get_google_drive_backup_service() -> GoogleDriveBackupService:
    settings = get_settings()
    return GoogleDriveBackupService(
        drive_client=GoogleDriveClient(
            service_account_file=settings.google_drive_service_account_file,
        ),
        folder_id=settings.google_drive_backup_folder_id,
    )


@router.post("/google-drive", response_model=BackupRead, status_code=status.HTTP_201_CREATED)
def create_google_drive_backup(
    payload: BackupCreate,
    db: Annotated[Session, Depends(get_db)],
    service: Annotated[GoogleDriveBackupService, Depends(get_google_drive_backup_service)],
) -> BackupResult:
    try:
        return service.backup_user(db, user_id=payload.user_id)
    except BackupUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
