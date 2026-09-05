"""Superadmin bootstrap + JSON migration (design D8; superadmin-bootstrap req)."""

import json
import os
import threading

import pytest
from sqlalchemy import func, select

from app import security
from app.config import settings
from app.db import SessionLocal
from app.models import History, Playlist, PlaylistTrack, User
from app.services import bootstrap as bootstrap_service


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "data_dir", str(tmp_path))
    return tmp_path


def _write_playlists(data_dir):
    (data_dir / "playlists.json").write_text(
        json.dumps(
            {
                "pl_a": {
                    "id": "pl_a",
                    "name": "Roadtrip",
                    "createdAt": 1_700_000_000,
                    "updatedAt": 1_700_000_100,
                    "tracks": [
                        {"id": "v1", "title": "One"},
                        {"id": "v2", "title": "Two"},
                        {"id": "v1", "title": "Dup of v1"},
                    ],
                }
            }
        ),
        encoding="utf-8",
    )


def _write_history(data_dir):
    (data_dir / "history.json").write_text(
        json.dumps(
            {
                "entries": [
                    {"videoId": "h1", "title": "H1", "playedAt": 1_700_000_000},
                    {
                        "videoId": "h2",
                        "title": "H2",
                        "artist": "A",
                        "playedAt": 1_700_000_200,
                        "playCount": 3,
                    },
                ]
            }
        ),
        encoding="utf-8",
    )


def test_happy_path_creates_one_superadmin_and_migrates(api, data_dir, db_reset, monkeypatch):
    monkeypatch.setattr(settings, "bootstrap_token", None)
    _write_playlists(data_dir)
    _write_history(data_dir)

    res = api.post(
        "/api/auth/bootstrap",
        json={"username": "root", "password": "first-admin-pass-1"},
    )
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "superadmin"
    assert "__Host-resonar_session" in res.cookies or res.cookies

    with SessionLocal() as db:
        users = db.execute(select(User)).scalars().all()
        assert len(users) == 1
        assert users[0].role == "superadmin"
        assert users[0].must_change_password is False
        uid = users[0].id
        assert db.execute(
            select(func.count()).select_from(Playlist).where(Playlist.user_id == uid)
        ).scalar_one() == 1
        assert db.execute(
            select(func.count()).select_from(PlaylistTrack)
        ).scalar_one() == 2  # duplicate v1 skipped
        assert db.execute(
            select(func.count()).select_from(History).where(History.user_id == uid)
        ).scalar_one() == 2

    assert os.path.exists(data_dir / "playlists.json.migrated")
    assert os.path.exists(data_dir / "history.json.migrated")
    assert not os.path.exists(data_dir / "playlists.json")


def test_missing_token_is_403_and_creates_no_user(api, data_dir, db_reset, monkeypatch):
    monkeypatch.setattr(settings, "bootstrap_token", "s3cret-token")
    res = api.post(
        "/api/auth/bootstrap",
        json={"username": "root", "password": "first-admin-pass-1"},
    )
    assert res.status_code == 403
    with SessionLocal() as db:
        assert db.execute(select(func.count()).select_from(User)).scalar_one() == 0


def test_second_call_is_410(api, data_dir, db_reset, monkeypatch):
    monkeypatch.setattr(settings, "bootstrap_token", None)
    first = api.post(
        "/api/auth/bootstrap",
        json={"username": "root", "password": "first-admin-pass-1"},
    )
    assert first.status_code == 200
    second = api.post(
        "/api/auth/bootstrap",
        json={"username": "root2", "password": "second-admin-pass-1"},
    )
    assert second.status_code == 410


def test_corrupt_playlists_json_is_skipped(api, data_dir, db_reset, monkeypatch):
    monkeypatch.setattr(settings, "bootstrap_token", None)
    (data_dir / "playlists.json").write_text("{ not valid json", encoding="utf-8")
    _write_history(data_dir)

    res = api.post(
        "/api/auth/bootstrap",
        json={"username": "root", "password": "first-admin-pass-1"},
    )
    assert res.status_code == 200
    with SessionLocal() as db:
        assert db.execute(select(func.count()).select_from(Playlist)).scalar_one() == 0
        assert db.execute(select(func.count()).select_from(History)).scalar_one() == 2


def test_concurrent_callers_serialize_to_exactly_one(pg_engine, data_dir, db_reset):
    pw_hash = security.hash_password("first-admin-pass-1")
    results: list = []

    def worker(name):
        try:
            results.append(("ok", bootstrap_service.run_bootstrap(name, pw_hash)))
        except bootstrap_service.BootstrapClosed:
            results.append(("closed", None))
        except Exception as exc:  # pragma: no cover
            results.append(("error", repr(exc)))

    threads = [threading.Thread(target=worker, args=(f"root{i}",)) for i in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    outcomes = sorted(r[0] for r in results)
    assert outcomes == ["closed", "ok"]
    with SessionLocal() as db:
        assert db.execute(select(func.count()).select_from(User)).scalar_one() == 1
