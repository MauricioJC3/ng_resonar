"""Integration tests for the /api/history endpoints."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import history as history_router
from app.services import history


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.include_router(history_router.router, prefix="/api")
    return TestClient(app)


def test_post_then_get_returns_the_stored_entry(client):
    body = {"videoId": "abc123", "title": "Test Song", "kind": "song", "source": "player"}
    res = client.post("/api/history", json=body)
    assert res.status_code == 200
    stored = res.json()
    assert stored["videoId"] == "abc123"
    assert stored["playCount"] == 1
    assert isinstance(stored["playedAt"], int)

    got = client.get("/api/history")
    assert got.status_code == 200
    results = got.json()["results"]
    assert len(results) == 1
    assert results[0]["videoId"] == "abc123"


def test_get_is_newest_first_and_limit_caps(client):
    for vid in ("a", "b", "c"):
        client.post("/api/history", json={"videoId": vid, "title": vid})
    results = client.get("/api/history", params={"limit": 2}).json()["results"]
    assert [e["videoId"] for e in results] == ["c", "b"]


def test_consecutive_repeat_yields_one_entry_with_play_count_two(client):
    body = {"videoId": "same", "title": "Same"}
    client.post("/api/history", json=body)
    client.post("/api/history", json=body)
    results = client.get("/api/history").json()["results"]
    assert len(results) == 1
    assert results[0]["playCount"] == 2


def test_delete_empties_history(client):
    client.post("/api/history", json={"videoId": "a", "title": "A"})
    res = client.delete("/api/history")
    assert res.status_code == 200
    assert res.json() == {"ok": True}
    assert client.get("/api/history").json()["results"] == []


def test_missing_video_id_is_rejected_and_not_persisted(client):
    res = client.post("/api/history", json={"title": "No id"})
    assert res.status_code == 422
    assert client.get("/api/history").json()["results"] == []


def test_missing_title_is_rejected(client):
    res = client.post("/api/history", json={"videoId": "abc"})
    assert res.status_code == 422


def test_empty_video_id_is_rejected(client):
    res = client.post("/api/history", json={"videoId": "", "title": "x"})
    assert res.status_code == 422


def test_oversized_body_is_rejected_and_not_persisted(client):
    res = client.post(
        "/api/history",
        json={"videoId": "abc", "title": "x" * 5000},
    )
    assert res.status_code == 422
    assert client.get("/api/history").json()["results"] == []


def test_entries_persist_across_a_fresh_service_load(client):
    client.post("/api/history", json={"videoId": "a", "title": "A"})
    # a brand-new process would re-read the same file the fixture pinned
    assert [e["videoId"] for e in history._load()["entries"]] == ["a"]
