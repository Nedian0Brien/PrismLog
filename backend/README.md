# PrismLog Backend

## Run locally (without Docker)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API

- `GET /health`
- `GET /health/db`
- `GET /api/v1/logs`
- `POST /api/v1/logs`
- `PATCH /api/v1/logs/{id}`
- `DELETE /api/v1/logs/{id}`
- `POST /api/v1/backups/google-drive`
- `POST /api/v1/dev/seed`

### Example create log

```bash
curl -X POST http://localhost:8001/api/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "demo-user",
    "category": "reading",
    "title": "클린 코드",
    "summary": "1장 정리",
    "tags": ["개발", "독서"],
    "payload": {"progress": 32, "pages_read": 148, "pages_total": 464}
  }'
```

## Google Drive backup

서버 서비스 계정으로 현재 사용자 데이터를 JSON 스냅샷으로 백업한다.

1. Google Cloud에서 Drive API를 활성화하고 서비스 계정 키 JSON을 발급한다.
2. 백업을 저장할 Drive 폴더를 만들고 서비스 계정 이메일에 폴더 쓰기 권한을 부여한다.
3. `.env`에 아래 값을 설정한다.

```bash
GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE=/absolute/path/to/service-account.json
GOOGLE_DRIVE_BACKUP_FOLDER_ID=drive-folder-id
```

```bash
curl -X POST http://localhost:8001/api/v1/backups/google-drive \
  -H "Content-Type: application/json" \
  -d '{"user_id": "demo-user"}'
```
