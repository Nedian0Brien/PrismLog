import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/game-sessions", status_code=201)
async def upload_game_session_photo(file: UploadFile = File(...)) -> dict:
    settings = get_settings()

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="허용되지 않는 파일 형식입니다. JPEG, PNG, WebP, GIF만 허용됩니다.",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기가 10MB를 초과합니다.")

    ext = Path(file.filename or "photo.jpg").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"

    upload_path = Path(settings.upload_dir) / "game-sessions"
    upload_path.mkdir(parents=True, exist_ok=True)

    (upload_path / filename).write_bytes(contents)

    return {"url": f"/uploads/game-sessions/{filename}", "filename": filename}


@router.delete("/game-sessions/{filename}")
async def delete_game_session_photo(filename: str) -> dict:
    settings = get_settings()

    # path traversal 방지
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")

    file_path = Path(settings.upload_dir) / "game-sessions" / filename
    if file_path.exists():
        file_path.unlink()

    return {"ok": True}
