from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.routers import backups
from app.services.backups import BackupResult, BackupUnavailableError


class StubBackupService:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    def backup_user(self, db, *, user_id):
        self.calls.append({"db": db, "user_id": user_id})
        if self.error:
            raise self.error
        return self.result


def test_create_google_drive_backup_returns_upload_result():
    service = StubBackupService(
        result=BackupResult(
            file_id="drive-file-1",
            file_name="prismlog-backup-demo-user-20260614T123000Z.json",
            web_view_link="https://drive.google.com/file/d/drive-file-1/view",
            counts={"entities": 2, "logs": 5},
            created_at=datetime(2026, 6, 14, 12, 30, tzinfo=timezone.utc).isoformat(),
        )
    )

    response = backups.create_google_drive_backup(
        backups.BackupCreate(user_id="demo-user"),
        db="db-session",
        service=service,
    )

    assert response.file_id == "drive-file-1"
    assert response.file_name == "prismlog-backup-demo-user-20260614T123000Z.json"
    assert response.web_view_link == "https://drive.google.com/file/d/drive-file-1/view"
    assert response.counts == {"entities": 2, "logs": 5}
    assert service.calls == [{"db": "db-session", "user_id": "demo-user"}]


def test_create_google_drive_backup_reports_missing_configuration():
    service = StubBackupService(error=BackupUnavailableError("GOOGLE_DRIVE_BACKUP_FOLDER_ID is required"))

    with pytest.raises(HTTPException) as raised:
        backups.create_google_drive_backup(
            backups.BackupCreate(user_id="demo-user"),
            db="db-session",
            service=service,
        )

    assert raised.value.status_code == 503
    assert raised.value.detail == "GOOGLE_DRIVE_BACKUP_FOLDER_ID is required"
