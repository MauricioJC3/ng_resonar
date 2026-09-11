"""Playlist data access, user-scoped (design D3).

Replaces the single-file JSON store in ``services/playlists.py``. Every function
takes ``user_id`` and filters on it, so one user can never read or mutate
another user's playlists. A playlist id that exists but belongs to someone else
is indistinguishable from a missing one: the lookup simply returns ``None`` and
the router turns that into a 404.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..models import Playlist, PlaylistTrack


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _new_id() -> str:
    return "pl_" + uuid.uuid4().hex[:12]


def get(db: Session, user_id: int, pid: str) -> Playlist | None:
    stmt = select(Playlist).where(
        Playlist.id == pid, Playlist.user_id == user_id
    )
    return db.execute(stmt).scalar_one_or_none()


def tracks_of(db: Session, user_id: int, pid: str) -> list[dict]:
    """Tracks of ``pid``, but only if ``pid`` belongs to ``user_id``.

    The ownership check is in the query itself (JOIN + ``user_id`` filter), not
    the caller: passing another user's playlist id simply yields an empty list.
    """
    stmt = (
        select(PlaylistTrack.track)
        .join(Playlist, Playlist.id == PlaylistTrack.playlist_id)
        .where(Playlist.id == pid, Playlist.user_id == user_id)
        .order_by(PlaylistTrack.position)
    )
    return [row for (row,) in db.execute(stmt).all()]


def _count(db: Session, user_id: int, pid: str) -> int:
    return db.execute(
        select(func.count())
        .select_from(PlaylistTrack)
        .join(Playlist, Playlist.id == PlaylistTrack.playlist_id)
        .where(Playlist.id == pid, Playlist.user_id == user_id)
    ).scalar_one()


def _first_thumbnail(db: Session, user_id: int, pid: str) -> str | None:
    stmt = (
        select(PlaylistTrack.track)
        .join(Playlist, Playlist.id == PlaylistTrack.playlist_id)
        .where(Playlist.id == pid, Playlist.user_id == user_id)
        .order_by(PlaylistTrack.position)
        .limit(1)
    )
    row = db.execute(stmt).scalar_one_or_none()
    return row.get("thumbnail") if isinstance(row, dict) else None


def list_summaries(db: Session, user_id: int) -> list[dict]:
    """Newest-updated first, matching the old JSON service ordering.

    One query instead of the previous N+1 (a ``_count`` + ``_first_thumbnail``
    round trip per playlist): track counts are aggregated with ``GROUP BY``
    and each playlist's first track (lowest ``position``) is picked with
    ``row_number() OVER (PARTITION BY playlist_id ORDER BY position)``; both
    are LEFT JOINed back onto ``playlists`` so empty playlists still come
    back with ``count=0`` / ``thumbnail=None``.
    """
    counts_subq = (
        select(
            PlaylistTrack.playlist_id.label("playlist_id"),
            func.count().label("track_count"),
        )
        .group_by(PlaylistTrack.playlist_id)
        .subquery()
    )

    ranked = select(
        PlaylistTrack.playlist_id.label("playlist_id"),
        PlaylistTrack.track.label("track"),
        func.row_number()
        .over(
            partition_by=PlaylistTrack.playlist_id,
            order_by=PlaylistTrack.position,
        )
        .label("rn"),
    ).subquery()
    first_track_subq = (
        select(ranked.c.playlist_id, ranked.c.track).where(ranked.c.rn == 1)
    ).subquery()

    stmt = (
        select(
            Playlist.id,
            Playlist.name,
            Playlist.updated_at,
            func.coalesce(counts_subq.c.track_count, 0).label("track_count"),
            first_track_subq.c.track.label("first_track"),
        )
        .outerjoin(counts_subq, counts_subq.c.playlist_id == Playlist.id)
        .outerjoin(
            first_track_subq, first_track_subq.c.playlist_id == Playlist.id
        )
        .where(Playlist.user_id == user_id)
        .order_by(Playlist.updated_at.desc())
    )

    out: list[dict] = []
    for pid, name, updated_at, track_count, first_track in db.execute(stmt).all():
        thumbnail = (
            first_track.get("thumbnail")
            if isinstance(first_track, dict)
            else None
        )
        out.append(
            {
                "id": pid,
                "name": name,
                "count": track_count,
                "thumbnail": thumbnail,
                "updatedAt": int(updated_at.timestamp()),
            }
        )
    return out


def _append_tracks(
    db: Session, pid: str, tracks: list[dict], *, start: int
) -> int:
    """Insert ``tracks`` skipping ids already present or repeated in the batch.

    Returns the next free position.
    """
    existing = {
        tid
        for (tid,) in db.execute(
            select(PlaylistTrack.track_id).where(
                PlaylistTrack.playlist_id == pid
            )
        ).all()
    }
    position = start
    for track in tracks:
        if not isinstance(track, dict):
            continue
        tid = track.get("id")
        if not tid or tid in existing:
            continue
        existing.add(tid)
        db.add(
            PlaylistTrack(
                playlist_id=pid,
                position=position,
                track_id=tid,
                track=track,
            )
        )
        position += 1
    return position


def create(
    db: Session, user_id: int, name: str, tracks: list[dict] | None = None
) -> Playlist:
    now = _now()
    pl = Playlist(
        id=_new_id(),
        user_id=user_id,
        name=(name or "").strip() or "Sin nombre",
        created_at=now,
        updated_at=now,
    )
    db.add(pl)
    db.flush()
    _append_tracks(db, pl.id, tracks or [], start=0)
    db.flush()
    return pl


def rename(
    db: Session, user_id: int, pid: str, name: str
) -> Playlist | None:
    pl = get(db, user_id, pid)
    if pl is None:
        return None
    pl.name = (name or "").strip() or pl.name
    pl.updated_at = _now()
    db.flush()
    return pl


def delete_(db: Session, user_id: int, pid: str) -> bool:
    pl = get(db, user_id, pid)
    if pl is None:
        return False
    db.delete(pl)
    db.flush()
    return True


def add_tracks(
    db: Session, user_id: int, pid: str, tracks: list[dict]
) -> Playlist | None:
    pl = get(db, user_id, pid)
    if pl is None:
        return None
    next_pos = db.execute(
        select(func.coalesce(func.max(PlaylistTrack.position), -1)).where(
            PlaylistTrack.playlist_id == pid
        )
    ).scalar_one()
    _append_tracks(db, pid, tracks, start=next_pos + 1)
    pl.updated_at = _now()
    db.flush()
    return pl


def remove_track(
    db: Session, user_id: int, pid: str, track_id: str
) -> Playlist | None:
    pl = get(db, user_id, pid)
    if pl is None:
        return None
    db.execute(
        delete(PlaylistTrack).where(
            PlaylistTrack.playlist_id == pid,
            PlaylistTrack.track_id == track_id,
        )
    )
    _resequence(db, pid)
    pl.updated_at = _now()
    db.flush()
    return pl


def reorder(
    db: Session, user_id: int, pid: str, ids: list[str]
) -> Playlist | None:
    pl = get(db, user_id, pid)
    if pl is None:
        return None
    rows = (
        db.execute(
            select(PlaylistTrack)
            .where(PlaylistTrack.playlist_id == pid)
            .order_by(PlaylistTrack.position)
        )
        .scalars()
        .all()
    )
    by_id = {r.track_id: r for r in rows}
    wanted = [by_id[i] for i in ids if i in by_id]
    rest = [r for r in rows if r.track_id not in set(ids)]
    for position, row in enumerate(wanted + rest):
        row.position = position
    pl.updated_at = _now()
    db.flush()
    return pl


def _resequence(db: Session, pid: str) -> None:
    rows = (
        db.execute(
            select(PlaylistTrack)
            .where(PlaylistTrack.playlist_id == pid)
            .order_by(PlaylistTrack.position)
        )
        .scalars()
        .all()
    )
    for position, row in enumerate(rows):
        row.position = position
