from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import os
from pathlib import Path

from dotenv import load_dotenv
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://code01.kr",
        "https://api.code01.kr",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # "*"
    ],
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
