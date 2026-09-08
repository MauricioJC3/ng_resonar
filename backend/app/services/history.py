"""User-scoped playback history backed by Postgres (design D3).

Thin shaping layer over ``repos/history.py``. It returns the same entry shape
the SPA already consumes (``videoId`` / ``playedAt`` epoch seconds / ``playCount``
/ ...), so the ``/api/history`` request and response contracts are unchanged
from the old JSON-file service.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import History
from ..repos import history as history_repo

# Kept for import compatibility with older tests / callers.
CAP = history_repo.CAP


def _serialize(row: History) -> dict:
    return {
        "videoId": row.video_id,
        "title": row.title,
        "artist": row.artist,
        "thumbnail": row.thumbnail,
        "kind": row.kind,
        "playedAt": int(row.played_at.timestamp()),
        "playCount": row.play_count,
        "source": row.source,
    }


def add(db: Session, user_id: int, entry: dict) -> dict:
    return _serialize(history_repo.add(db, user_id, entry))


def list_entries(
    db: Session,
    user_id: int,
    limit: int | None = None,
    kind: str | None = None,
) -> list[dict]:
    return [
        _serialize(row)
        for row in history_repo.list_(db, user_id, limit, kind)
    ]


def clear(db: Session, user_id: int, kind: str | None = None) -> None:
    history_repo.clear_(db, user_id, kind)
