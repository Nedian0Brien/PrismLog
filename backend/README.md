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

## Required media API keys

- `TMDB_API_KEY`: 영화/시리즈 검색 및 상세 정보
- `RAWG_API_KEY`: 게임 검색 및 상세 정보

## API

- `GET /health`
- `GET /health/db`
- `GET /api/v1/logs`
- `POST /api/v1/logs`
- `PATCH /api/v1/logs/{id}`
- `DELETE /api/v1/logs/{id}`
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
