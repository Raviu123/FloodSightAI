import os
import logging
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .base import Base

logger = logging.getLogger("floodshield.db")
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
SQLITE_URL = "sqlite:///./floodshield.db"
SQLITE_ASYNC_URL = "sqlite+aiosqlite:///./floodshield.db"

# Format URLs for Async and Sync
async_db_url = None
sync_db_url = None

if DATABASE_URL:
    # Normalize postgres URL prefixes
    if DATABASE_URL.startswith("postgres://"):
        cleaned = DATABASE_URL.removeprefix("postgres://")
        async_db_url = f"postgresql+asyncpg://{cleaned}"
        sync_db_url = f"postgresql://{cleaned}"
    elif DATABASE_URL.startswith("postgresql://"):
        cleaned = DATABASE_URL.removeprefix("postgresql://")
        async_db_url = f"postgresql+asyncpg://{cleaned}"
        sync_db_url = f"postgresql://{cleaned}"
    elif DATABASE_URL.startswith("postgresql+asyncpg://"):
        async_db_url = DATABASE_URL
        sync_db_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    else:
        async_db_url = DATABASE_URL
        sync_db_url = DATABASE_URL


def create_sync_engine_instance():
    """Creates a resilient sync engine with Supabase Postgres and SQLite failover."""
    if sync_db_url:
        try:
            eng = create_engine(
                sync_db_url,
                pool_pre_ping=True,
                connect_args={"connect_timeout": 3} if "postgresql" in sync_db_url else {},
            )
            with eng.connect() as conn:
                pass
            logger.info("Connected to Supabase PostgreSQL (Sync Engine)")
            return eng
        except Exception as e:
            logger.warning(f"Supabase connection failed ({e}). Falling back to local SQLite: {SQLITE_URL}")
    
    return create_engine(SQLITE_URL, connect_args={"check_same_thread": False})


sync_engine = create_sync_engine_instance()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)

# Async Engine for Supabase asyncpg workflows
if async_db_url and "postgresql" in async_db_url:
    async_engine = create_async_engine(async_db_url, pool_pre_ping=True)
else:
    async_engine = None

AsyncSessionLocal = (
    async_sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)
    if async_engine
    else None
)


def get_db():
    """Sync session dependency for standard routes and simulation processing."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db():
    """Async session dependency for Supabase async operations."""
    if AsyncSessionLocal:
        async with AsyncSessionLocal() as session:
            yield session
    else:
        # Fallback for offline SQLite
        db: Session = SessionLocal()
        try:
            yield db
        finally:
            db.close()


def init_db() -> None:
    """Initializes all tables in the active database (Supabase or SQLite)."""
    Base.metadata.create_all(bind=sync_engine)


async def init_async_db() -> None:
    """Async database initialization."""
    if async_engine:
        async with async_engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    else:
        init_db()