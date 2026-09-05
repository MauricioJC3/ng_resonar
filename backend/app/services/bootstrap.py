"""One-time superadmin bootstrap + JSON -> Postgres migration (design D8).

All DB work runs in a single transaction serialized by a Postgres advisory
transaction lock. The legacy JSON files are renamed to ``*.migrated`` only
after that transaction commits.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal
from ..models import History, Playlist, PlaylistTrack
from ..models.user import ROLE_SUPERADMIN
from ..repos import users as users_repo

log = logging.getLogger("resonar.bootstrap")

# Arbitrary constant key so concurrent bootstrap callers serialize on it.
_ADVISORY_LOCK_KEY = 0xB0075742

HISTORY_CAP = 800


class BootstrapClosed(Exception):
    """Raised when at least one user already exists (bootstrap is permanent)."""


def _ts(value: object) -> datetime:
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError, OverflowError):
        return datetime.now(tz=timezone.utc)


def _playlists_path() -> str:
    return os.path.join(settings.data_dir, "playlists.json")


def _history_path() -> str:
    return os.path.join(settings.data_dir, "history.json")


def _migrate_playlists(db: Session, user_id: int) -> int:
    path = _playlists_path()
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return 0
    except (OSError, json.JSONDecodeError) as exc:
        log.warning("skipping playlists.json migration: %s", exc)
        return 0

    count = 0
    for pl in (data or {}).values():
        if not isinstance(pl, dict) or not pl.get("id"):
            continue
        db.add(
            Playlist(
                id=pl["id"],
                user_id=user_id,
                name=(pl.get("name") or "Untitled").strip() or "Untitled",
                created_at=_ts(pl.get("createdAt")),
                updated_at=_ts(pl.get("updatedAt")),
            )
        )
        seen: set[str] = set()
        position = 0
        for track in pl.get("tracks") or []:
            track_id = track.get("id") if isinstance(track, dict) else None
            if not track_id or track_id in seen:
                continue
            seen.add(track_id)
            db.add(
                PlaylistTrack(
                    playlist_id=pl["id"],
                    position=position,
                    track_id=track_id,
                    track=track,
                )
            )
            position += 1
        count += 1
    db.flush()
    return count


def _migrate_history(db: Session, user_id: int) -> int:
    path = _history_path()
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        return 0
    except (OSError, json.JSONDecodeError) as exc:
        log.warning("skipping history.json migration: %s", exc)
        return 0

    entries = data.get("entries") if isinstance(data, dict) else None
    if not isinstance(entries, list):
        return 0

    for entry in entries[-HISTORY_CAP:]:
        if not isinstance(entry, dict) or not entry.get("videoId"):
            continue
        db.add(
            History(
                user_id=user_id,
                video_id=entry["videoId"],
                title=entry.get("title") or entry["videoId"],
                artist=entry.get("artist"),
                thumbnail=entry.get("thumbnail"),
                kind=entry.get("kind") or "song",
                source=entry.get("source"),
                play_count=int(entry.get("playCount") or 1),
                played_at=_ts(entry.get("playedAt")),
            )
        )
    db.flush()
    return min(len(entries), HISTORY_CAP)


def _rename_migrated() -> None:
    for path in (_playlists_path(), _history_path()):
        if not os.path.exists(path):
            continue
        try:
            os.replace(path, path + ".migrated")
        except OSError as exc:  # pragma: no cover - best effort
            log.warning("could not rename %s: %s", path, exc)


def run_bootstrap(username: str, password_hash: str) -> int:
    """Create the superadmin, migrate legacy JSON, return the new user id."""
    db = SessionLocal()
    try:
        db.execute(
            text("SELECT pg_advisory_xact_lock(:k)"),
            {"k": _ADVISORY_LOCK_KEY},
        )
        if users_repo.count(db) != 0:
            db.rollback()
            raise BootstrapClosed()

        user = users_repo.create(
            db,
            username=username,
            password_hash=password_hash,
            role=ROLE_SUPERADMIN,
            must_change_password=False,
        )
        user_id = user.id
        _migrate_playlists(db, user_id)
        _migrate_history(db, user_id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    _rename_migrated()
    return user_id
