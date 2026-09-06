"""User-scoped playlist repo (design D3; playlists-isolation req).

Runs against the SAVEPOINT-rolled-back ``db_session`` fixture, plus one HTTP
test that a guessed id belonging to another user is a 404 for GET / PATCH /
DELETE.
"""

import pytest
from sqlalchemy import select

from app import security
from app.models import PlaylistTrack, User
from app.models.user import ROLE_USER
from app.repos import playlists as playlists_repo


def _track(tid: str) -> dict:
    return {"id": tid, "title": tid.upper(), "thumbnail": f"http://t/{tid}.jpg"}


def _mk_user(db_session, username: str) -> User:
    user = User(
        username=username,
        password_hash=security.hash_password("playlist-user-pass-1"),
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


def test_lists_are_scoped_to_the_owner(db_session, alice, bob):
    playlists_repo.create(db_session, alice.id, "Roadtrip", [_track("t1")])
    assert playlists_repo.list_summaries(db_session, bob.id) == []
    summaries = playlists_repo.list_summaries(db_session, alice.id)
    assert len(summaries) == 1
    assert summaries[0]["name"] == "Roadtrip"
    assert summaries[0]["count"] == 1
    assert summaries[0]["thumbnail"] == "http://t/t1.jpg"
    assert isinstance(summaries[0]["updatedAt"], int)


def test_another_users_id_is_invisible_to_get_rename_delete(db_session, alice, bob):
    pl = playlists_repo.create(db_session, alice.id, "Secret", [])
    assert playlists_repo.get(db_session, bob.id, pl.id) is None
    assert playlists_repo.rename(db_session, bob.id, pl.id, "hax") is None
    assert playlists_repo.delete_(db_session, bob.id, pl.id) is False
    # untouched for the real owner
    assert playlists_repo.get(db_session, alice.id, pl.id) is not None


def test_repo_helpers_are_scoped_to_the_owner(db_session, alice, bob):
    """``tracks_of`` / ``_count`` / ``_first_thumbnail`` must be user-scoped in
    the query itself: another user's real playlist id yields nothing."""
    pl = playlists_repo.create(
        db_session, alice.id, "Alice Mix", [_track("t1"), _track("t2")]
    )

    assert [
        t["id"] for t in playlists_repo.tracks_of(db_session, alice.id, pl.id)
    ] == ["t1", "t2"]
    assert playlists_repo._count(db_session, alice.id, pl.id) == 2
    assert (
        playlists_repo._first_thumbnail(db_session, alice.id, pl.id)
        == "http://t/t1.jpg"
    )

    assert playlists_repo.tracks_of(db_session, bob.id, pl.id) == []
    assert playlists_repo._count(db_session, bob.id, pl.id) == 0
    assert playlists_repo._first_thumbnail(db_session, bob.id, pl.id) is None


def test_playlist_track_dedupe_on_create_and_add(db_session, alice):
    pl = playlists_repo.create(
        db_session,
        alice.id,
        "Mix",
        [_track("t1"), _track("t1"), _track("t2")],
    )
    assert [
        t["id"] for t in playlists_repo.tracks_of(db_session, alice.id, pl.id)
    ] == [
        "t1",
        "t2",
    ]

    playlists_repo.add_tracks(
        db_session, alice.id, pl.id, [_track("t2"), _track("t3")]
    )
    assert [
        t["id"] for t in playlists_repo.tracks_of(db_session, alice.id, pl.id)
    ] == [
        "t1",
        "t2",
        "t3",
    ]
    rows = db_session.execute(
        select(PlaylistTrack).where(PlaylistTrack.playlist_id == pl.id)
    ).scalars().all()
    assert sorted(r.position for r in rows) == [0, 1, 2]


def test_remove_track_resequences_positions(db_session, alice):
    pl = playlists_repo.create(
        db_session, alice.id, "L", [_track("t1"), _track("t2"), _track("t3")]
    )
    playlists_repo.remove_track(db_session, alice.id, pl.id, "t2")
    rows = db_session.execute(
        select(PlaylistTrack)
        .where(PlaylistTrack.playlist_id == pl.id)
        .order_by(PlaylistTrack.position)
    ).scalars().all()
    assert [(r.track_id, r.position) for r in rows] == [("t1", 0), ("t3", 1)]


def test_reorder_puts_requested_ids_first(db_session, alice):
    pl = playlists_repo.create(
        db_session, alice.id, "L", [_track("a"), _track("b"), _track("c")]
    )
    playlists_repo.reorder(db_session, alice.id, pl.id, ["c", "a"])
    assert [
        t["id"] for t in playlists_repo.tracks_of(db_session, alice.id, pl.id)
    ] == [
        "c",
        "a",
        "b",
    ]


def test_guessed_id_is_404_over_http_for_get_patch_delete(api, as_user, db_reset):
    from app.db import SessionLocal

    alice = as_user("alice")
    with SessionLocal() as db:
        pl = playlists_repo.create(db, alice.id, "alice list", [])
        db.commit()
        pid = pl.id

    as_user("bob")
    assert api.get(f"/api/playlists/{pid}").status_code == 404
    assert (
        api.patch(f"/api/playlists/{pid}", json={"name": "x"}).status_code == 404
    )
    assert api.delete(f"/api/playlists/{pid}").status_code == 404
