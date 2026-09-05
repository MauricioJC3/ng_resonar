"""Shared test fixtures.

Backend auth/DB tests need Postgres. They run inside the ``python:3.12-slim``
backend image (the host lacks argon2 / psycopg wheels):

    docker compose up -d db
    docker compose run --rm -v "$PWD/backend:/app" \
      -e DATABASE_URL=postgresql+psycopg://resonar:resonar@db:5432/resonar \
      backend sh -c "pip install -q -r requirements-dev.txt && python -m pytest -q"

If ``DATABASE_URL`` is not reachable the ``pg_engine`` fixture falls back to a
``testcontainers`` ``postgres:16-alpine`` instance (design D17).
"""

from __future__ import annotations

import os

# Must be set before importing any app module so app.config.settings sees it.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://resonar:resonar@db:5432/resonar",
)
# Tests always use fakeredis; never let the app lifespan grab a real Redis.
os.environ.pop("REDIS_URL", None)

import pytest

_BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
_TABLES = (
    "user_settings",
    "history",
    "favorites",
    "playlist_tracks",
    "playlists",
    "users",
)


# --- legacy JSON history service (still present until Slice 2) ---------------
@pytest.fixture(autouse=True)
def tmp_history(tmp_path, monkeypatch):
    """Point the JSON history service at a throwaway data dir."""
    from app.services import history

    monkeypatch.setattr(history.settings, "data_dir", str(tmp_path))
    monkeypatch.setattr(history, "_FILE", str(tmp_path / "history.json"))
    yield tmp_path


# --- Postgres ---------------------------------------------------------------
def _reachable(url: str) -> bool:
    try:
        import sqlalchemy

        eng = sqlalchemy.create_engine(url, future=True)
        with eng.connect():
            pass
        eng.dispose()
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def _pg_url():
    url = os.environ.get("DATABASE_URL", "")
    if url and _reachable(url):
        yield url
        return
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine", driver="psycopg") as pg:
        yield pg.get_connection_url()


@pytest.fixture(scope="session")
def pg_engine(_pg_url):
    os.environ["DATABASE_URL"] = _pg_url

    from alembic import command
    from alembic.config import Config

    from app import db as db_mod
    from app.config import settings

    settings.database_url = _pg_url
    settings.redis_url = None
    # The TestClient talks plain HTTP, so a Secure cookie would be dropped by its
    # cookie jar. Mirrors SESSION_COOKIE_SECURE=false for local dev.
    settings.session_cookie_secure = False
    engine = db_mod.init_engine(_pg_url)

    cfg = Config(os.path.join(_BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(_BACKEND_DIR, "alembic"))
    cfg.set_main_option("sqlalchemy.url", _pg_url)
    command.upgrade(cfg, "head")

    yield engine
    db_mod.dispose_engine()


@pytest.fixture
def db_session(pg_engine):
    """Per-test session wrapped in an outer transaction that is always rolled
    back — nested writes use SAVEPOINTs (join-an-external-transaction)."""
    from sqlalchemy.orm import Session

    conn = pg_engine.connect()
    outer = conn.begin()
    session = Session(
        bind=conn,
        join_transaction_mode="create_savepoint",
        expire_on_commit=False,
    )
    try:
        yield session
    finally:
        session.close()
        if outer.is_active:
            outer.rollback()
        conn.close()


def _truncate(pg_engine) -> None:
    from sqlalchemy import text

    with pg_engine.begin() as conn:
        conn.execute(
            text("TRUNCATE " + ", ".join(_TABLES) + " RESTART IDENTITY CASCADE")
        )


@pytest.fixture
def db_reset(pg_engine):
    """Truncate every table after a test that commits outside ``db_session``
    (e.g. the bootstrap flow, which opens its own transaction)."""
    yield
    _truncate(pg_engine)


# --- Redis ---------------------------------------------------------------
@pytest.fixture
def fake_redis():
    import fakeredis.aioredis as fake_aioredis

    from app import deps

    client = fake_aioredis.FakeRedis(decode_responses=True)
    prev = deps.redis
    deps.redis = client
    try:
        yield client
    finally:
        deps.redis = prev


# --- FastAPI client ---------------------------------------------------------
def _rebind_engine(pg_engine) -> None:
    """The app lifespan disposes the engine on shutdown; restore the session
    binding so later tests (and the session-scoped fixture) keep working."""
    from app import db as db_mod

    db_mod.engine = pg_engine
    db_mod.SessionLocal.configure(bind=pg_engine)


@pytest.fixture
def client(pg_engine, db_session, fake_redis):
    """Real app; ``get_db`` bound to the rolled-back ``db_session``. Use this for
    tests that only read/seed through that one session."""
    from fastapi.testclient import TestClient

    from app.db import get_db
    from app.main import app

    app.dependency_overrides[get_db] = lambda: db_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        _rebind_engine(pg_engine)


@pytest.fixture
def api(pg_engine, fake_redis):
    """Real app with a real committing session per request (matches production
    ``get_db``). Every table is truncated on teardown. Use this for the
    login / logout / bootstrap flows, which commit their own transactions."""
    from fastapi.testclient import TestClient

    from app.db import SessionLocal, get_db
    from app.main import app

    def _get_db():
        db = SessionLocal()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        _rebind_engine(pg_engine)
        _truncate(pg_engine)
