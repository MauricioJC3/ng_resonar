"""User-scoped playlists backed by Postgres (design D3).

Thin shaping layer over ``repos/playlists.py``: it turns ORM rows into the exact
JSON shapes the SPA already expects (``PlaylistSummary`` / ``Playlist``), so the
request and response contracts are unchanged from the old JSON-file service.
Every call is scoped to ``user_id``.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import Playlist as PlaylistRow
from ..repos import playlists as playlists_repo


def _detail(db: Session, pl: PlaylistRow) -> dict:
    tracks = playlists_repo.tracks_of(db, pl.id)
    return {
        "id": pl.id,
        "name": pl.name,
        "count": len(tracks),
        "thumbnail": tracks[0].get("thumbnail") if tracks else None,
        "createdAt": int(pl.created_at.timestamp()),
        "updatedAt": int(pl.updated_at.timestamp()),
        "tracks": tracks,
    }


def list_playlists(db: Session, user_id: int) -> list[dict]:
    return playlists_repo.list_summaries(db, user_id)


def get(db: Session, user_id: int, pid: str) -> dict | None:
    pl = playlists_repo.get(db, user_id, pid)
    return _detail(db, pl) if pl is not None else None


def create(
    db: Session, user_id: int, name: str, tracks: list[dict] | None = None
) -> dict:
    pl = playlists_repo.create(db, user_id, name, tracks)
    return _detail(db, pl)


def rename(db: Session, user_id: int, pid: str, name: str) -> dict | None:
    pl = playlists_repo.rename(db, user_id, pid, name)
    return _detail(db, pl) if pl is not None else None


def delete(db: Session, user_id: int, pid: str) -> bool:
    return playlists_repo.delete_(db, user_id, pid)


def add_tracks(
    db: Session, user_id: int, pid: str, tracks: list[dict]
) -> dict | None:
    pl = playlists_repo.add_tracks(db, user_id, pid, tracks)
    return _detail(db, pl) if pl is not None else None


def remove_track(
    db: Session, user_id: int, pid: str, track_id: str
) -> dict | None:
    pl = playlists_repo.remove_track(db, user_id, pid, track_id)
    return _detail(db, pl) if pl is not None else None


def reorder(
    db: Session, user_id: int, pid: str, ids: list[str]
) -> dict | None:
    pl = playlists_repo.reorder(db, user_id, pid, ids)
    return _detail(db, pl) if pl is not None else None
