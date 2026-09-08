"""Tests for the user-scoped Postgres history repo + its thin service shaper.

Replaces the old JSON-file service tests (design §5). Everything here runs
against the SAVEPOINT-rolled-back ``db_session`` fixture.
"""

import pytest
from sqlalchemy import select

from app import security
from app.models import History, User
from app.models.user import ROLE_USER
from app.repos import history as history_repo
from app.services import history as history_service


def _mk_user(db_session, username: str) -> User:
    user = User(
        username=username,
        password_hash=security.hash_password("history-user-pass-1"),
        role=ROLE_USER,
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def alice(db_session) -> User:
    return _mk_user(db_session, "alice")


@pytest.fixture
def bob(db_session) -> User:
    return _mk_user(db_session, "bob")


def _entry(vid: str, **over) -> dict:
    base = {"videoId": vid, "title": f"Song {vid}", "kind": "song"}
    base.update(over)
    return base


def test_add_stamps_played_at_and_play_count(db_session, alice):
    row = history_repo.add(db_session, alice.id, _entry("a"))
    assert row.play_count == 1
    assert row.played_at is not None
    assert row.user_id == alice.id


def test_consecutive_repeat_coalesces_bumping_count_and_played_at(db_session, alice):
    history_repo.add(db_session, alice.id, _entry("a"))

    # Backdate the row so the refresh is observable.
    row = db_session.execute(
        select(History).where(History.user_id == alice.id)
    ).scalar_one()
    old_played_at = row.played_at.replace(year=2000)
    row.played_at = old_played_at
    db_session.flush()

    again = history_repo.add(db_session, alice.id, _entry("a"))
    rows = history_repo.list_(db_session, alice.id)
    assert len(rows) == 1
    assert again.play_count == 2
    assert again.played_at > old_played_at


def test_a_different_video_in_between_breaks_the_streak(db_session, alice):
    history_repo.add(db_session, alice.id, _entry("a"))
    history_repo.add(db_session, alice.id, _entry("b"))
    history_repo.add(db_session, alice.id, _entry("a"))
    rows = history_repo.list_(db_session, alice.id)
    assert [r.video_id for r in rows] == ["a", "b", "a"]
    assert all(r.play_count == 1 for r in rows)


def test_list_is_newest_first_and_respects_limit(db_session, alice):
    for vid in ("a", "b", "c", "d"):
        history_repo.add(db_session, alice.id, _entry(vid))
    assert [r.video_id for r in history_repo.list_(db_session, alice.id)] == [
        "d",
        "c",
        "b",
        "a",
    ]
    assert [
        r.video_id for r in history_repo.list_(db_session, alice.id, 2)
    ] == ["d", "c"]


def test_cap_drops_oldest_on_overflow(db_session, alice):
    from datetime import datetime, timedelta, timezone

    base = datetime(2020, 1, 1, tzinfo=timezone.utc)
    overflow = 24
    for i in range(history_repo.CAP + overflow):
        db_session.add(
            History(
                user_id=alice.id,
                video_id=f"v{i:04d}",
                title=f"v{i:04d}",
                kind="song",
                play_count=1,
                played_at=base + timedelta(minutes=i),
            )
        )
    db_session.flush()

    # An insert triggers the 800-row cap trim.
    history_repo.add(db_session, alice.id, _entry("newest"))

    rows = history_repo.list_(db_session, alice.id)
    assert len(rows) == history_repo.CAP
    assert rows[0].video_id == "newest"
    kept_ids = {r.video_id for r in rows}
    assert "v0000" not in kept_ids  # oldest dropped
    assert f"v{history_repo.CAP + overflow - 1:04d}" in kept_ids  # newest kept


def test_list_filters_by_kind(db_session, alice):
    history_repo.add(db_session, alice.id, _entry("s1", kind="song"))
    history_repo.add(db_session, alice.id, _entry("v1", kind="video"))
    history_repo.add(db_session, alice.id, _entry("s2", kind="song"))

    assert [
        r.video_id for r in history_repo.list_(db_session, alice.id, kind="song")
    ] == ["s2", "s1"]
    assert [
        r.video_id for r in history_repo.list_(db_session, alice.id, kind="video")
    ] == ["v1"]
    assert len(history_repo.list_(db_session, alice.id)) == 3


def test_clear_with_kind_only_removes_that_kind(db_session, alice):
    history_repo.add(db_session, alice.id, _entry("s1", kind="song"))
    history_repo.add(db_session, alice.id, _entry("v1", kind="video"))
    history_repo.clear_(db_session, alice.id, kind="video")
    assert [r.video_id for r in history_repo.list_(db_session, alice.id)] == ["s1"]


def test_clear_is_user_scoped(db_session, alice, bob):
    history_repo.add(db_session, alice.id, _entry("a1"))
    history_repo.add(db_session, bob.id, _entry("b1"))
    history_repo.clear_(db_session, alice.id)
    assert history_repo.list_(db_session, alice.id) == []
    assert [r.video_id for r in history_repo.list_(db_session, bob.id)] == ["b1"]


def test_reads_and_writes_never_cross_users(db_session, alice, bob):
    history_repo.add(db_session, alice.id, _entry("alice-only"))
    history_repo.add(db_session, bob.id, _entry("bob-only"))
    assert [r.video_id for r in history_repo.list_(db_session, alice.id)] == [
        "alice-only"
    ]
    assert [r.video_id for r in history_repo.list_(db_session, bob.id)] == [
        "bob-only"
    ]


def test_service_serializes_to_the_spa_entry_shape(db_session, alice):
    stored = history_service.add(
        db_session, alice.id, _entry("abc", source="player", artist="A")
    )
    assert stored["videoId"] == "abc"
    assert stored["playCount"] == 1
    assert stored["source"] == "player"
    assert stored["artist"] == "A"
    assert isinstance(stored["playedAt"], int)

    listed = history_service.list_entries(db_session, alice.id)
    assert [e["videoId"] for e in listed] == ["abc"]
    assert isinstance(listed[0]["playedAt"], int)
