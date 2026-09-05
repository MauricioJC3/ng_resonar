"""SQLAlchemy engine / session wiring.

The engine is a process-wide singleton built in the app lifespan (see main.py),
mirroring how ``deps.http`` / ``deps.cache`` are created — never at import time,
so tests can bind their own engine.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import settings

# Unbound until ``init_engine`` runs. ``expire_on_commit=False`` keeps ORM
# instances usable after the request-scoped commit in ``get_db``.
SessionLocal = sessionmaker(
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    future=True,
)

engine: Engine | None = None


def init_engine(url: str | None = None) -> Engine:
    """Create the engine and bind ``SessionLocal`` to it. Idempotent per url."""
    global engine
    engine = create_engine(
        url or settings.database_url,
        future=True,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
    )
    SessionLocal.configure(bind=engine)
    return engine


def dispose_engine() -> None:
    global engine
    if engine is not None:
        engine.dispose()
        engine = None


def get_db() -> Iterator[Session]:
    """FastAPI dependency: commit on success, roll back on error, always close."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
