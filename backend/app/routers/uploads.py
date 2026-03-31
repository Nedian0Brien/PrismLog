import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import get_settings

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

ALLOWED_CATEGORIES = {"game-sessions", "reading-sessions", "study-sessions"}

# content_type이 None이거나 application/octet-stream인 경우 파일 확장자로 판단
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}


def _is_allowed_image(file: UploadFile) -> bool:
    ct = (file.content_type or "").lower()
    if ct.startswith("image/"):
        return True
    ext = Path(file.filename or "").suffix.lower()
    return ext in ALLOWED_EXTENSIONS


@router.post("/{category}", status_code=201)
async def upload_photo(category: str, file: UploadFile = File(...)) -> dict:
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")

    settings = get_settings()

    if not _is_allowed_image(file):
        raise HTTPException(
            status_code=400,
            detail="허용되지 않는 파일 형식입니다. 이미지 파일만 업로드할 수 있습니다.",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="파일 크기가 10MB를 초과합니다.")

    ext = Path(file.filename or "photo.jpg").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        ext = ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"

    upload_path = Path(settings.upload_dir) / category
    upload_path.mkdir(parents=True, exist_ok=True)

    (upload_path / filename).write_bytes(contents)

    return {"url": f"/uploads/{category}/{filename}", "filename": filename}


@router.delete("/{category}/{filename}")
async def delete_photo(category: str, filename: str) -> dict:
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")

    settings = get_settings()

    # path traversal 방지
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="잘못된 파일명입니다.")

    file_path = Path(settings.upload_dir) / category / filename
    if file_path.exists():
        file_path.unlink()

    return {"ok": True}
