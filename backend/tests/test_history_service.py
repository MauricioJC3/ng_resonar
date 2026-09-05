"""Unit tests for the JSON-file playback history service."""

import time

from app.services import history


def _entry(vid: str, **over) -> dict:
    base = {"videoId": vid, "title": f"Song {vid}", "kind": "song"}
    base.update(over)
    return base


def test_add_stamps_played_at_and_play_count():
    before = int(time.time())
    stored = history.add(_entry("a"))
    assert stored["playCount"] == 1
    assert before <= stored["playedAt"] <= int(time.time()) + 1
    assert "playedAt" not in _entry("a")  # caller never supplies it


def test_consecutive_repeat_dedupes_and_bumps_count():
    history.add(_entry("a"))
    history.add(_entry("a"))
    stored = history.add(_entry("a"))
    entries = history.list_entries()
    assert len(entries) == 1
    assert stored["playCount"] == 3
    assert entries[0]["playCount"] == 3


def test_different_video_in_between_breaks_the_streak():
    history.add(_entry("a"))
    history.add(_entry("b"))
    history.add(_entry("a"))
    entries = history.list_entries()  # newest-first
    assert [e["videoId"] for e in entries] == ["a", "b", "a"]
    assert all(e["playCount"] == 1 for e in entries)


def test_list_entries_is_newest_first_and_respects_limit():
    for vid in ("a", "b", "c", "d"):
        history.add(_entry(vid))
    assert [e["videoId"] for e in history.list_entries()] == ["d", "c", "b", "a"]
    assert [e["videoId"] for e in history.list_entries(2)] == ["d", "c"]


def test_cap_drops_oldest_on_overflow():
    total = history.CAP + 25
    for i in range(total):
        history.add(_entry(f"v{i:04d}"))
    entries = history.list_entries()
    assert len(entries) == history.CAP
    # newest kept, oldest 25 dropped
    assert entries[0]["videoId"] == f"v{total - 1:04d}"
    assert entries[-1]["videoId"] == f"v{total - history.CAP:04d}"


def test_clear_empties_history():
    history.add(_entry("a"))
    history.add(_entry("b"))
    history.clear()
    assert history.list_entries() == []


def test_entries_survive_a_fresh_load():
    history.add(_entry("a", source="player"))
    history.add(_entry("b", source="watch"))
    # simulate a process restart: nothing cached in-module, re-read from disk
    reloaded = history._load()
    assert [e["videoId"] for e in reloaded["entries"]] == ["a", "b"]
    assert reloaded["entries"][0]["source"] == "player"


def test_load_is_tolerant_of_a_corrupt_file(tmp_history):
    (tmp_history / "history.json").write_text("{ not json", encoding="utf-8")
    assert history._load() == {"entries": []}
    # a following write recovers cleanly
    history.add(_entry("a"))
    assert [e["videoId"] for e in history.list_entries()] == ["a"]
