"""Pure-function tests for the recommendation ranking logic.

`recommend()` itself is async and fans out to ytmusicapi, so it is covered by
manual verification (see openspec apply-progress). These cover the deterministic
helpers `pick_seeds` and `rank`.
"""

from app.services.recommend import pick_seeds, rank


def _entry(vid: str) -> dict:
    return {"videoId": vid, "title": vid.upper(), "playedAt": 0}


def test_pick_seeds_keeps_first_unique_in_order():
    entries = [_entry("a"), _entry("b"), _entry("a"), _entry("c"), _entry("b")]
    assert pick_seeds(entries, 12) == ["a", "b", "c"]


def test_pick_seeds_caps_at_n():
    entries = [_entry(c) for c in "abcdefghijklmnop"]
    assert pick_seeds(entries, 12) == list("abcdefghijkl")


def test_pick_seeds_ignores_missing_ids():
    entries = [{"title": "no id"}, _entry("x"), {"videoId": ""}, _entry("y")]
    assert pick_seeds(entries, 12) == ["x", "y"]


def _track(tid: str) -> dict:
    return {"id": tid, "title": tid.upper(), "artists": ["A"]}


def test_rank_orders_by_cross_seed_frequency():
    # seed order = [s0 (most recent), s1, s2]
    by_seed = {
        "s0": [_track("x"), _track("y")],
        "s1": [_track("y"), _track("z")],
        "s2": [_track("y")],
    }
    ranked = rank(by_seed, ["s0", "s1", "s2"], exclude=set())
    # y appears for 3 seeds, x and z for 1 each -> y first
    assert [t["id"] for t in ranked][0] == "y"
    assert set(t["id"] for t in ranked) == {"x", "y", "z"}


def test_rank_breaks_ties_by_seed_recency():
    # x only from the most recent seed, z only from the oldest -> x before z
    by_seed = {"s0": [_track("x")], "s1": [], "s2": [_track("z")]}
    ranked = rank(by_seed, ["s0", "s1", "s2"], exclude=set())
    assert [t["id"] for t in ranked] == ["x", "z"]


def test_rank_excludes_ids():
    by_seed = {"s0": [_track("x"), _track("y"), _track("z")]}
    ranked = rank(by_seed, ["s0"], exclude={"y"})
    assert [t["id"] for t in ranked] == ["x", "z"]


def test_rank_caps_result():
    by_seed = {"s0": [_track(f"t{i}") for i in range(50)]}
    ranked = rank(by_seed, ["s0"], exclude=set(), cap=30)
    assert len(ranked) == 30


def test_rank_dedupes_within_a_single_seed():
    by_seed = {"s0": [_track("x"), _track("x"), _track("y")]}
    ranked = rank(by_seed, ["s0"], exclude=set())
    assert [t["id"] for t in ranked] == ["x", "y"]
