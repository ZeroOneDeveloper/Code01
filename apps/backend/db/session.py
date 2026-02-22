import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .base import Base

SESSION_DIR = Path(__file__).resolve().parent
for candidate in (
    SESSION_DIR / ".env",
    SESSION_DIR.parent / ".env",
    SESSION_DIR.parent.parent / ".env",
    SESSION_DIR.parent.parent.parent / ".env",
):
    load_dotenv(candidate)

POSTGRES_USER = os.getenv("POSTGRES_USER", "code01")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "2kxqfurhHMaqjbOZA7GpLG7ps3SkwtAI")
POSTGRES_DB = os.getenv("POSTGRES_DB", "code01")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@localhost:5432/{POSTGRES_DB}",
)

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    future=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    # 모델 import가 선행되어야 metadata에 테이블이 등록됩니다.
    from . import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.exec_driver_sql(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text"
        )
        await conn.exec_driver_sql(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id text"
        )
        await conn.exec_driver_sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS name text")
        await conn.exec_driver_sql(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname text"
        )
        await conn.exec_driver_sql(
            "ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS student_id text"
        )
        await conn.exec_driver_sql(
            "ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS name text"
        )
        await conn.exec_driver_sql(
            "ALTER TABLE pending_signups ADD COLUMN IF NOT EXISTS nickname text"
        )
