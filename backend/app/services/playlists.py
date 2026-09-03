"""Server-side playlists in a single JSON file (single-user app, cross-device)."""

from __future__ import annotations

import json
import os
import threading
import time
import uuid

from ..config import settings

_FILE = os.path.join(settings.data_dir, "playlists.json")
_lock = threading.Lock()


def ensure() -> None:
    os.makedirs(settings.data_dir, exist_ok=True)
    if not os.path.exists(_FILE):
        with open(_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f)


def _load() -> dict:
    ensure()
    try:
        with open(_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _save(data: dict) -> None:
    ensure()
    tmp = _FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, _FILE)


def _summary(pl: dict) -> dict:
    tracks = pl.get("tracks", [])
    return {
        "id": pl["id"],
        "name": pl["name"],
        "count": len(tracks),
        "thumbnail": tracks[0].get("thumbnail") if tracks else None,
        "updatedAt": pl.get("updatedAt", 0),
    }


def list_playlists() -> list[dict]:
    data = _load()
    return sorted(
        (_summary(p) for p in data.values()),
        key=lambda s: s["updatedAt"],
        reverse=True,
    )


def get(pid: str) -> dict | None:
    return _load().get(pid)


def create(name: str, tracks: list[dict] | None = None) -> dict:
    with _lock:
        data = _load()
        pid = "pl_" + uuid.uuid4().hex[:12]
        now = int(time.time())
        pl = {
            "id": pid,
            "name": (name or "").strip() or "Sin nombre",
            "createdAt": now,
            "updatedAt": now,
            "tracks": tracks or [],
        }
        data[pid] = pl
        _save(data)
        return pl


def rename(pid: str, name: str) -> dict | None:
    with _lock:
        data = _load()
        pl = data.get(pid)
        if not pl:
            return None
        pl["name"] = (name or "").strip() or pl["name"]
        pl["updatedAt"] = int(time.time())
        _save(data)
        return pl


def delete(pid: str) -> bool:
    with _lock:
        data = _load()
        if pid not in data:
            return False
        del data[pid]
        _save(data)
        return True


def add_tracks(pid: str, tracks: list[dict]) -> dict | None:
    with _lock:
        data = _load()
        pl = data.get(pid)
        if not pl:
            return None
        have = {t.get("id") for t in pl["tracks"]}
        for t in tracks:
            tid = t.get("id")
            if tid and tid not in have:
                pl["tracks"].append(t)
                have.add(tid)
        pl["updatedAt"] = int(time.time())
        _save(data)
        return pl


def remove_track(pid: str, track_id: str) -> dict | None:
    with _lock:
        data = _load()
        pl = data.get(pid)
        if not pl:
            return None
        pl["tracks"] = [t for t in pl["tracks"] if t.get("id") != track_id]
        pl["updatedAt"] = int(time.time())
        _save(data)
        return pl


def reorder(pid: str, ids: list[str]) -> dict | None:
    with _lock:
        data = _load()
        pl = data.get(pid)
        if not pl:
            return None
        by_id = {t.get("id"): t for t in pl["tracks"]}
        wanted = set(ids)
        pl["tracks"] = [by_id[i] for i in ids if i in by_id] + [
            t for t in pl["tracks"] if t.get("id") not in wanted
        ]
        pl["updatedAt"] = int(time.time())
        _save(data)
        return pl
