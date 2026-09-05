"""History-seeded recommendation logic.

Pure helpers (`pick_seeds`, `rank`) plus one defensive async orchestrator
(`recommend`). This module owns no router imports and never raises: the worst
case is an empty list or the `ytmusic.home()` fallback, mirroring the defensive
posture of `ytmusic._related_sync`.
"""

from __future__ import annotations

import asyncio
import hashlib

from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from ..repos import history as history_repo
from ..services import ytmusic

# Pinned values (see design Part B).
_SEED_COUNT = 12
_RELATED_PER_SEED = 15
_RELATED_TIMEOUT = 4.0
_RANK_CAP = 30
_RECS_TTL = 1800
_RELATED_TTL = 3600


def pick_seeds(entries: list[dict], n: int = _SEED_COUNT) -> list[str]:
    """First `n` unique ``videoId``s from newest-first history entries."""
    seen: set[str] = set()
    out: list[str] = []
    for entry in entries:  # entries arrive newest-first
        vid = entry.get("videoId")
        if vid and vid not in seen:
            seen.add(vid)
            out.append(vid)
        if len(out) >= n:
            break
    return out


# Phase brief calls this `seeds_from_history`; keep both names pointing at one impl.
seeds_from_history = pick_seeds


def rank(
    results_by_seed: dict[str, list[dict]],
    seed_order: list[str],
    exclude: set[str],
    cap: int = _RANK_CAP,
) -> list[dict]:
    """Rank flattened candidates.

    Primary key: number of distinct seeds that returned the track (desc).
    Secondary key: recency of the earliest seed that produced it (a more recent
    seed, i.e. a lower index in ``seed_order``, wins). Stable for full ties.
    """
    freq: dict[str, int] = {}
    best_recency: dict[str, int] = {}
    meta: dict[str, dict] = {}
    first_seen: list[str] = []

    for i, seed in enumerate(seed_order):  # i == 0 -> most recent seed
        seen_this_seed: set[str] = set()
        for track in results_by_seed.get(seed, []) or []:
            tid = track.get("id")
            if not tid or tid in exclude or tid in seen_this_seed:
                continue
            seen_this_seed.add(tid)
            if tid not in meta:
                meta[tid] = track
                first_seen.append(tid)
                best_recency[tid] = i
            freq[tid] = freq.get(tid, 0) + 1
            best_recency[tid] = min(best_recency[tid], i)

    ordered = sorted(first_seen, key=lambda tid: (-freq[tid], best_recency[tid]))
    return [meta[tid] for tid in ordered[:cap]]


async def _safe_home(limit: int) -> list[dict]:
    try:
        results = await ytmusic.home()
    except Exception:  # noqa: BLE001 - ytmusicapi internals are brittle
        return []
    return results[:limit] if results else []


async def _related_cached(
    cache, video_id: str, limit: int = _RELATED_PER_SEED
) -> tuple[str, list[dict]]:
    """Shared `related:{id}` cached path — same key as `/api/related`."""
    ck = f"related:{video_id}"
    try:
        hit = await cache.get(ck)
    except Exception:  # noqa: BLE001
        hit = None
    if hit is not None:
        return video_id, hit
    try:
        results = await asyncio.wait_for(
            ytmusic.related(video_id, limit), timeout=_RELATED_TIMEOUT
        )
    except Exception:  # noqa: BLE001 - timeouts and ytmusicapi errors both land here
        results = []
    if results:
        try:
            await cache.set(ck, results, _RELATED_TTL)
        except Exception:  # noqa: BLE001
            pass
    return video_id, results


def _history_rows(db: Session, user_id: int) -> list[dict]:
    """Only ever this user's rows — there is no cross-user read path."""
    rows = history_repo.list_(db, user_id, None)
    return [{"videoId": row.video_id} for row in rows]


async def recommend(
    cache, db: Session, user_id: int, limit: int = _RANK_CAP
) -> list[dict]:
    """History-seeded recommendations with a ranked-result cache + home fallback.

    The seed history is read strictly for ``user_id``, so one user's plays never
    influence another user's recommendations (spec: per-user-recommendations).
    """
    try:
        entries = await run_in_threadpool(_history_rows, db, user_id)
    except Exception:  # noqa: BLE001
        entries = []

    seeds = pick_seeds(entries, _SEED_COUNT)
    if not seeds:
        return await _safe_home(limit)

    key = "recs:v1:" + hashlib.sha1(",".join(sorted(seeds)).encode()).hexdigest()
    try:
        hit = await cache.get(key)
    except Exception:  # noqa: BLE001
        hit = None
    if hit is not None:
        return hit[:limit]

    try:
        pairs = await asyncio.gather(*(_related_cached(cache, s) for s in seeds))
    except Exception:  # noqa: BLE001 - each _related_cached is already defensive
        pairs = []
    by_seed = {seed: results for seed, results in pairs}

    history_ids = {e.get("videoId") for e in entries if e.get("videoId")}
    exclude = history_ids | set(seeds)
    ranked = rank(by_seed, seeds, exclude, cap=_RANK_CAP)
    if not ranked:
        return await _safe_home(limit)

    try:
        await cache.set(key, ranked, _RECS_TTL)
    except Exception:  # noqa: BLE001
        pass
    return ranked[:limit]
