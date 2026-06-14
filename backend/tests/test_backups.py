from datetime import datetime, timezone
from uuid import uuid4

from app.models import Log, LogEntity
from app.services.backups import (
    BackupUnavailableError,
    GoogleDriveBackupService,
    build_backup_snapshot,
)


class RecordingDriveClient:
    def __init__(self):
        self.uploads = []

    def upload_json(self, *, file_name, content, folder_id):
        self.uploads.append({
            "file_name": file_name,
            "content": content,
            "folder_id": folder_id,
        })
        return {
            "id": "drive-file-1",
            "name": file_name,
            "webViewLink": "https://drive.google.com/file/d/drive-file-1/view",
        }


class ScalarResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class BackupSession:
    def __init__(self, *, entities=None, logs=None, expected_user_id="backup-user"):
        self.entities = entities or []
        self.logs = logs or []
        self.expected_user_id = expected_user_id
        self.statements = []

    def scalars(self, statement):
        self.statements.append(statement)
        params = statement.compile().params
        assert self.expected_user_id in params.values()
        entity = statement.column_descriptions[0]["entity"]
        if entity is LogEntity:
            return ScalarResult(self.entities)
        if entity is Log:
            return ScalarResult(self.logs)
        raise AssertionError(f"unexpected query entity: {entity}")


def test_build_backup_snapshot_includes_user_entities_and_logs():
    user_id = "backup-user"
    entity_id = uuid4()
    log_id = uuid4()
    occurred_at = datetime(2026, 6, 14, 10, 20, tzinfo=timezone.utc)

    db_session = BackupSession(
        entities=[
            LogEntity(
            id=entity_id,
            user_id=user_id,
            category="reading",
            title="백업 대상 책",
            source_id="isbn:123",
            entity_metadata={"author": "테스트 저자"},
            )
        ],
        logs=[
            Log(
            id=log_id,
            entity_id=entity_id,
            user_id=user_id,
            category="reading",
            title="백업 대상 로그",
            summary="읽은 내용",
            tags=["backup"],
            payload={"pages_read": 12},
            occurred_at=occurred_at,
            )
        ],
    )

    snapshot = build_backup_snapshot(db_session, user_id=user_id)

    assert snapshot["format"] == "prismlog.backup.v1"
    assert snapshot["user_id"] == user_id
    assert snapshot["counts"] == {"entities": 1, "logs": 1}
    assert snapshot["entities"][0]["id"] == str(entity_id)
    assert snapshot["entities"][0]["entity_metadata"] == {"author": "테스트 저자"}
    assert snapshot["logs"][0]["id"] == str(log_id)
    assert snapshot["logs"][0]["entity_id"] == str(entity_id)
    assert snapshot["logs"][0]["payload"] == {"pages_read": 12}
    assert snapshot["logs"][0]["occurred_at"] == "2026-06-14T10:20:00+00:00"


def test_google_drive_backup_service_uploads_snapshot_to_configured_folder():
    user_id = "backup-user"
    drive_client = RecordingDriveClient()
    service = GoogleDriveBackupService(
        drive_client=drive_client,
        folder_id="drive-folder-1",
        clock=lambda: datetime(2026, 6, 14, 12, 30, tzinfo=timezone.utc),
    )
    db_session = BackupSession(
        logs=[
            Log(
                user_id=user_id,
                category="study",
                title="테스트 공부",
                summary="백업",
                tags=["study"],
                payload={"minutes": 40},
            )
        ],
        expected_user_id=user_id,
    )

    result = service.backup_user(db_session, user_id=user_id)

    assert result.file_id == "drive-file-1"
    assert result.file_name == "prismlog-backup-backup-user-20260614T123000Z.json"
    assert result.web_view_link == "https://drive.google.com/file/d/drive-file-1/view"
    assert result.counts == {"entities": 0, "logs": 1}
    assert drive_client.uploads[0]["folder_id"] == "drive-folder-1"
    assert drive_client.uploads[0]["file_name"] == result.file_name
    assert drive_client.uploads[0]["content"]["user_id"] == user_id


def test_google_drive_backup_service_requires_folder_id():
    service = GoogleDriveBackupService(
        drive_client=RecordingDriveClient(),
        folder_id="",
        clock=lambda: datetime(2026, 6, 14, tzinfo=timezone.utc),
    )
    db_session = BackupSession(expected_user_id="backup-user")

    try:
        service.backup_user(db_session, user_id="backup-user")
    except BackupUnavailableError as exc:
        assert "GOOGLE_DRIVE_BACKUP_FOLDER_ID" in str(exc)
    else:
        raise AssertionError("expected BackupUnavailableError")
