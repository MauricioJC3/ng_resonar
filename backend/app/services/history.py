"""Server-side playback history in a single JSON file (single-user app, cross-device)."""

from __future__ import annotations

import json
import os
import threading
import time

from ..config import settings

_FILE = os.path.join(settings.data_dir, "history.json")
_lock = threading.Lock()

# Pinned entry cap, within the 500-1000 band from the spec. On any write that
# would exceed it, the oldest entries are dropped.
CAP = 800


def ensure() -> None:
    os.makedirs(settings.data_dir, exist_ok=True)
    if not os.path.exists(_FILE):
        with open(_FILE, "w", encoding="utf-8") as f:
            json.dump({"entries": []}, f)


def _load() -> dict:
    ensure()
    try:
        with open(_FILE, encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data.get("entries"), list) else {"entries": []}
    except (OSError, json.JSONDecodeError):
        return {"entries": []}


def _save(data: dict) -> None:
    ensure()
    tmp = _FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, _FILE)


def add(entry: dict) -> dict:
    with _lock:
        data = _load()
        entries = data["entries"]
        now = int(time.time())
        vid = entry["videoId"]
        if entries and entries[-1].get("videoId") == vid:  # consecutive repeat
            entries[-1]["playedAt"] = now
            entries[-1]["playCount"] = entries[-1].get("playCount", 1) + 1
            stored = entries[-1]
        else:
            stored = {**entry, "playedAt": now, "playCount": 1}
            entries.append(stored)
        if len(entries) > CAP:  # drop oldest
            del entries[: len(entries) - CAP]
        data["entries"] = entries
        _save(data)
        return stored


def list_entries(limit: int | None = None) -> list[dict]:
    entries = list(reversed(_load()["entries"]))  # newest-first
    return entries[:limit] if limit else entries


def clear() -> None:
    with _lock:
        _save({"entries": []})
