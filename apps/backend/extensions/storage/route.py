import os
from pathlib import Path, PurePosixPath
from urllib.parse import quote

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

router = APIRouter(
    prefix="/storage",
    tags=["storage"],
    responses={404: {"description": "Not found"}},
)

STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "./uploads"))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def _normalize_relative_path(path: str) -> str:
    cleaned = path.strip().lstrip("/")
    pure = PurePosixPath(cleaned)

    if pure.is_absolute() or ".." in pure.parts:
        raise HTTPException(status_code=400, detail="Invalid path")

    normalized = str(pure)
    if not normalized or normalized == ".":
        raise HTTPException(status_code=400, detail="Invalid path")

    return normalized


def _encode_path_for_url(path: str) -> str:
    return "/".join(quote(part) for part in path.split("/"))


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    path: str = Form(...),
    bucket: str = Form("default"),
    upsert: bool = Form(False),
):
    safe_bucket = _normalize_relative_path(bucket)
    safe_path = _normalize_relative_path(path)

    target_rel = f"{safe_bucket}/{safe_path}"
    target_abs = STORAGE_DIR / target_rel
    target_abs.parent.mkdir(parents=True, exist_ok=True)

    if target_abs.exists() and not upsert:
        raise HTTPException(status_code=409, detail="File already exists")

    content = await file.read()
    with target_abs.open("wb") as fp:
        fp.write(content)

    base_url = str(request.base_url).rstrip("/")
    public_url = f"{base_url}/uploads/{_encode_path_for_url(target_rel)}"

    return {
        "path": safe_path,
        "bucket": safe_bucket,
        "stored_path": target_rel,
        "public_url": public_url,
        "error": None,
    }
