"""Playback-history data access, user-scoped (design D3).

Replaces the single-file JSON store in ``services/history.py``. The two
behaviours the old service had are kept, now per user and in SQL:

* consecutive-repeat coalescing — replaying the same video without anything in
  between bumps ``play_count`` and refreshes ``played_at`` instead of adding a
  row;
* an 800-row cap — after an insert the oldest rows beyond the newest 800 are
  deleted.

The newest row is located with ``SELECT ... ORDER BY played_at DESC LIMIT 1 FOR
UPDATE`` so two concurrent writers for the same user cannot both insert a
"first" row.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..models import History

CAP = 800


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _newest_for_update(db: Session, user_id: int) -> History | None:
    stmt = (
        select(History)
        .where(History.user_id == user_id)
        .order_by(History.played_at.desc(), History.id.desc())
        .limit(1)
        .with_for_update()
    )
    return db.execute(stmt).scalar_one_or_none()


def _trim(db: Session, user_id: int) -> None:
    keep = (
        select(History.id)
        .where(History.user_id == user_id)
        .order_by(History.played_at.desc(), History.id.desc())
        .limit(CAP)
    )
    db.execute(
        delete(History)
        .where(History.user_id == user_id, ~History.id.in_(keep))
        .execution_options(synchronize_session=False)
    )


def add(db: Session, user_id: int, entry: dict) -> History:
    """Insert a play, coalescing a consecutive repeat of the same video."""
    video_id = entry["videoId"]
    newest = _newest_for_update(db, user_id)
    if newest is not None and newest.video_id == video_id:
        newest.played_at = _now()
        newest.play_count = newest.play_count + 1
        db.flush()
        return newest

    row = History(
        user_id=user_id,
        video_id=video_id,
        title=entry.get("title") or video_id,
        artist=entry.get("artist"),
        thumbnail=entry.get("thumbnail"),
        kind=entry.get("kind") or "song",
        source=entry.get("source"),
        play_count=1,
        played_at=_now(),
    )
    db.add(row)
    db.flush()
    _trim(db, user_id)
    return row


def list_(
    db: Session, user_id: int, limit: int | None = None
) -> list[History]:
    stmt = (
        select(History)
        .where(History.user_id == user_id)
        .order_by(History.played_at.desc(), History.id.desc())
    )
    if limit:
        stmt = stmt.limit(limit)
    return list(db.execute(stmt).scalars().all())


def clear_(db: Session, user_id: int) -> None:
    db.execute(
        delete(History)
        .where(History.user_id == user_id)
        .execution_options(synchronize_session=False)
    )


def count(db: Session, user_id: int) -> int:
    return db.execute(
        select(func.count())
        .select_from(History)
        .where(History.user_id == user_id)
    ).scalar_one()
