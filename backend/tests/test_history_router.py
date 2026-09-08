"""Integration tests for /api/history against the real app.

The old file built a bare ``FastAPI()`` with no auth and no DB. Now it uses the
real ``app`` with ``get_db`` + ``current_user`` overridden (design §5), and
proves two seeded users never see each other's rows.
"""


def test_post_then_get_returns_the_stored_entry(api, as_user, db_reset):
    as_user("alice")
    res = api.post(
        "/api/history",
        json={
            "videoId": "abc123",
            "title": "Test Song",
            "kind": "song",
            "source": "player",
        },
    )
    assert res.status_code == 200
    stored = res.json()
    assert stored["videoId"] == "abc123"
    assert stored["playCount"] == 1
    assert isinstance(stored["playedAt"], int)

    results = api.get("/api/history").json()["results"]
    assert [e["videoId"] for e in results] == ["abc123"]


def test_get_is_newest_first_and_limit_caps(api, as_user, db_reset):
    as_user("alice")
    for vid in ("a", "b", "c"):
        api.post("/api/history", json={"videoId": vid, "title": vid})
    results = api.get("/api/history", params={"limit": 2}).json()["results"]
    assert [e["videoId"] for e in results] == ["c", "b"]


def test_consecutive_repeat_yields_one_entry_with_play_count_two(api, as_user, db_reset):
    as_user("alice")
    body = {"videoId": "same", "title": "Same"}
    api.post("/api/history", json=body)
    api.post("/api/history", json=body)
    results = api.get("/api/history").json()["results"]
    assert len(results) == 1
    assert results[0]["playCount"] == 2


def test_kind_filter_splits_songs_and_videos(api, as_user, db_reset):
    as_user("alice")
    api.post("/api/history", json={"videoId": "s1", "title": "Song 1", "kind": "song"})
    api.post("/api/history", json={"videoId": "v1", "title": "Video 1", "kind": "video"})
    api.post("/api/history", json={"videoId": "s2", "title": "Song 2", "kind": "song"})

    songs = api.get("/api/history", params={"kind": "song"}).json()["results"]
    assert [e["videoId"] for e in songs] == ["s2", "s1"]

    videos = api.get("/api/history", params={"kind": "video"}).json()["results"]
    assert [e["videoId"] for e in videos] == ["v1"]

    all_ = api.get("/api/history").json()["results"]
    assert {e["videoId"] for e in all_} == {"s1", "s2", "v1"}


def test_delete_with_kind_only_clears_that_kind(api, as_user, db_reset):
    as_user("alice")
    api.post("/api/history", json={"videoId": "s1", "title": "S", "kind": "song"})
    api.post("/api/history", json={"videoId": "v1", "title": "V", "kind": "video"})

    assert api.delete("/api/history", params={"kind": "video"}).json() == {"ok": True}

    remaining = api.get("/api/history").json()["results"]
    assert [e["videoId"] for e in remaining] == ["s1"]


def test_bad_kind_is_rejected(api, as_user, db_reset):
    as_user("alice")
    assert api.get("/api/history", params={"kind": "podcast"}).status_code == 422


def test_delete_empties_only_the_callers_history(api, as_user, db_reset):
    as_user("alice")
    api.post("/api/history", json={"videoId": "a", "title": "A"})
    as_user("bob")
    api.post("/api/history", json={"videoId": "b", "title": "B"})

    as_user("alice")
    assert api.delete("/api/history").json() == {"ok": True}
    assert api.get("/api/history").json()["results"] == []

    as_user("bob")
    assert [e["videoId"] for e in api.get("/api/history").json()["results"]] == ["b"]


def test_neither_user_sees_the_others_rows(api, as_user, db_reset):
    as_user("alice")
    api.post("/api/history", json={"videoId": "alice-song", "title": "A"})
    as_user("bob")
    api.post("/api/history", json={"videoId": "bob-song", "title": "B"})

    assert [e["videoId"] for e in api.get("/api/history").json()["results"]] == [
        "bob-song"
    ]
    as_user("alice")
    assert [e["videoId"] for e in api.get("/api/history").json()["results"]] == [
        "alice-song"
    ]


def test_missing_video_id_is_rejected_and_not_persisted(api, as_user, db_reset):
    as_user("alice")
    res = api.post("/api/history", json={"title": "No id"})
    assert res.status_code == 422
    assert api.get("/api/history").json()["results"] == []


def test_missing_title_is_rejected(api, as_user, db_reset):
    as_user("alice")
    assert api.post("/api/history", json={"videoId": "abc"}).status_code == 422


def test_oversized_body_is_rejected_and_not_persisted(api, as_user, db_reset):
    as_user("alice")
    res = api.post(
        "/api/history", json={"videoId": "abc", "title": "x" * 5000}
    )
    assert res.status_code == 422
    assert api.get("/api/history").json()["results"] == []
