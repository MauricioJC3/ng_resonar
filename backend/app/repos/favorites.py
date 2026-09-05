"""Server-side favorites, user-scoped (design D3).

New in this slice: favorites used to live only in the browser under
``localStorage['resonar:library']``. They now belong to the backend, one set
per user, deduped by ``(user_id, track_id)``. No ``localStorage`` values are
imported — every user starts empty.
"""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import Favorite


def list_(db: Session, user_id: int) -> list[dict]:
    """Full track payloads, newest first."""
    stmt = (
        select(Favorite.track)
        .where(Favorite.user_id == user_id)
        .order_by(Favorite.created_at.desc(), Favorite.id.desc())
    )
    return [row for (row,) in db.execute(stmt).all()]


def add(db: Session, user_id: int, track: dict) -> bool:
    """Insert a favorite. Returns ``False`` when it was already present."""
    track_id = track.get("id")
    if not track_id:
        return False
    exists = db.execute(
        select(Favorite.id).where(
            Favorite.user_id == user_id, Favorite.track_id == track_id
        )
    ).scalar_one_or_none()
    if exists is not None:
        return False
    db.add(Favorite(user_id=user_id, track_id=track_id, track=track))
    db.flush()
    return True


def remove(db: Session, user_id: int, track_id: str) -> bool:
    result = db.execute(
        delete(Favorite).where(
            Favorite.user_id == user_id, Favorite.track_id == track_id
        )
    )
    db.flush()
    return result.rowcount > 0
