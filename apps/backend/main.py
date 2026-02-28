import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

APP_DIR = Path(__file__).resolve().parent
for candidate in (
    APP_DIR / ".env",
    APP_DIR.parent / ".env",
    APP_DIR.parent.parent / ".env",
):
    load_dotenv(candidate)

from db.session import engine, init_db

app = FastAPI()


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


default_frontend_origins = [
    "https://code01.kr",
    "http://code01.kr",
    "https://www.code01.kr",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
frontend_origin = os.getenv("FRONTEND_ORIGIN")
extra_origins = _split_csv(os.getenv("FRONTEND_ALLOWED_ORIGINS"))

allow_origins = list(
    {
        *default_frontend_origins,
        *( [frontend_origin] if frontend_origin else [] ),
        *extra_origins,
    }
)

# 내부망 IP(10.x / 172.16-31.x / 192.168.x) + localhost에서 3000 포트 접근 허용
allow_origin_regex = os.getenv(
    "FRONTEND_ALLOWED_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:3000)?$",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

storage_dir = Path(os.getenv("STORAGE_DIR", "./uploads"))
storage_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(storage_dir)), name="uploads")


for extension in os.listdir("./extensions/"):
    if not os.path.isdir(os.path.join("./extensions/", extension)):
        continue

    if not os.path.exists(os.path.join("./extensions/", extension, "route.py")):
        continue

    module_name = f"extensions.{extension}.route"
    try:
        module = __import__(module_name, fromlist=["router"])
        app.include_router(module.router)
        print(f"Included router from {module_name}")
    except ImportError as e:
        print(f"Failed to import {module_name}: {e}")
    except AttributeError as e:
        print(f"Router not found in {module_name}: {e}")
    continue


@app.get("/")
async def root():
    return {"message": "Hello, World!"}


@app.on_event("startup")
async def startup_event():
    await init_db()


@app.get("/health/db")
async def health_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3001,
        reload=True,
    )
