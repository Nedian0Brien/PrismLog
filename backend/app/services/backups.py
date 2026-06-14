import io
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Log, LogEntity


BACKUP_FORMAT = "prismlog.backup.v1"
DRIVE_FILE_MIME_TYPE = "application/json"
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"


class BackupUnavailableError(RuntimeError):
    pass


class DriveClient(Protocol):
    def upload_json(self, *, file_name: str, content: dict[str, Any], folder_id: str) -> dict[str, Any]:
        ...


@dataclass(frozen=True)
class BackupResult:
    file_id: str
    file_name: str
    web_view_link: str | None
    counts: dict[str, int]
    created_at: str


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _serialize_entity(entity: LogEntity) -> dict[str, Any]:
    return {
        "id": str(entity.id),
        "user_id": entity.user_id,
        "category": entity.category,
        "title": entity.title,
        "source_id": entity.source_id,
        "entity_metadata": entity.entity_metadata or {},
        "created_at": _serialize_datetime(entity.created_at),
        "updated_at": _serialize_datetime(entity.updated_at),
    }


def _serialize_log(log: Log) -> dict[str, Any]:
    return {
        "id": str(log.id),
        "entity_id": str(log.entity_id) if log.entity_id else None,
        "user_id": log.user_id,
        "category": log.category,
        "title": log.title,
        "summary": log.summary,
        "tags": log.tags or [],
        "payload": log.payload or {},
        "occurred_at": _serialize_datetime(log.occurred_at),
        "created_at": _serialize_datetime(log.created_at),
        "updated_at": _serialize_datetime(log.updated_at),
    }


def build_backup_snapshot(db: Session, *, user_id: str, created_at: datetime | None = None) -> dict[str, Any]:
    backup_created_at = created_at or datetime.now(timezone.utc)
    entities = list(
        db.scalars(
            select(LogEntity)
            .where(LogEntity.user_id == user_id)
            .order_by(LogEntity.created_at, LogEntity.id)
        ).all()
    )
    logs = list(
        db.scalars(
            select(Log)
            .where(Log.user_id == user_id)
            .order_by(Log.occurred_at, Log.created_at, Log.id)
        ).all()
    )

    return {
        "format": BACKUP_FORMAT,
        "created_at": _serialize_datetime(backup_created_at),
        "user_id": user_id,
        "counts": {
            "entities": len(entities),
            "logs": len(logs),
        },
        "entities": [_serialize_entity(entity) for entity in entities],
        "logs": [_serialize_log(log) for log in logs],
    }


def _safe_filename_part(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    normalized = normalized.strip("-._")
    return normalized or "user"


class GoogleDriveBackupService:
    def __init__(
        self,
        *,
        drive_client: DriveClient,
        folder_id: str,
        clock: Callable[[], datetime] | None = None,
    ):
        self.drive_client = drive_client
        self.folder_id = folder_id
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def backup_user(self, db: Session, *, user_id: str) -> BackupResult:
        if not self.folder_id.strip():
            raise BackupUnavailableError("GOOGLE_DRIVE_BACKUP_FOLDER_ID is required")

        created_at = self.clock()
        snapshot = build_backup_snapshot(db, user_id=user_id, created_at=created_at)
        timestamp = created_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        file_name = f"prismlog-backup-{_safe_filename_part(user_id)}-{timestamp}.json"
        uploaded = self.drive_client.upload_json(
            file_name=file_name,
            content=snapshot,
            folder_id=self.folder_id,
        )

        return BackupResult(
            file_id=str(uploaded["id"]),
            file_name=str(uploaded.get("name") or file_name),
            web_view_link=uploaded.get("webViewLink"),
            counts=snapshot["counts"],
            created_at=snapshot["created_at"],
        )


class GoogleDriveClient:
    def __init__(self, *, service_account_file: str):
        self.service_account_file = service_account_file

    def upload_json(self, *, file_name: str, content: dict[str, Any], folder_id: str) -> dict[str, Any]:
        if not self.service_account_file.strip():
            raise BackupUnavailableError("GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE is required")

        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
            from googleapiclient.http import MediaIoBaseUpload
        except ImportError as exc:
            raise BackupUnavailableError("Google Drive client libraries are not installed") from exc

        credentials = service_account.Credentials.from_service_account_file(
            self.service_account_file,
            scopes=[DRIVE_SCOPE],
        )
        service = build("drive", "v3", credentials=credentials, cache_discovery=False)
        content_bytes = json.dumps(content, ensure_ascii=False, indent=2).encode("utf-8")
        media = MediaIoBaseUpload(
            io.BytesIO(content_bytes),
            mimetype=DRIVE_FILE_MIME_TYPE,
            resumable=False,
        )
        metadata: dict[str, Any] = {
            "name": file_name,
            "mimeType": DRIVE_FILE_MIME_TYPE,
            "parents": [folder_id],
        }
        return (
            service.files()
            .create(body=metadata, media_body=media, fields="id,name,webViewLink")
            .execute()
        )
