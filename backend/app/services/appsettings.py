"""User settings (scrobbling credentials) persisted to data/settings.json."""

from __future__ import annotations

import copy
import json
import os
import threading

from ..config import settings as env

_FILE = os.path.join(env.data_dir, "settings.json")
_lock = threading.Lock()

_DEFAULT = {
    "listenbrainz": {"enabled": False, "token": ""},
    "lastfm": {
        "enabled": False,
        "apiKey": "",
        "apiSecret": "",
        "sessionKey": "",
        "username": "",
    },
}


def _merge_defaults(data: dict) -> dict:
    out = copy.deepcopy(_DEFAULT)
    for group, vals in data.items():
        if group in out and isinstance(vals, dict):
            out[group].update({k: v for k, v in vals.items() if k in out[group]})
    return out


def load() -> dict:
    try:
        with open(_FILE, encoding="utf-8") as f:
            return _merge_defaults(json.load(f))
    except (OSError, json.JSONDecodeError):
        return copy.deepcopy(_DEFAULT)


def _write(data: dict) -> None:
    os.makedirs(env.data_dir, exist_ok=True)
    tmp = _FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, _FILE)


def update(patch: dict) -> dict:
    """Merge a patch. Secret fields are only overwritten when a non-empty
    value is supplied, so the UI can send blanks without wiping them."""
    secret_fields = {"token", "apiKey", "apiSecret", "sessionKey"}
    with _lock:
        data = load()
        for group, vals in (patch or {}).items():
            if group not in data or not isinstance(vals, dict):
                continue
            for key, value in vals.items():
                if key not in data[group]:
                    continue
                if key in secret_fields and (value is None or value == ""):
                    continue
                data[group][key] = value
        _write(data)
        return data


def set_lastfm_session(session_key: str, username: str) -> None:
    with _lock:
        data = load()
        data["lastfm"]["sessionKey"] = session_key
        data["lastfm"]["username"] = username
        data["lastfm"]["enabled"] = True
        _write(data)


def redacted() -> dict:
    d = load()
    lb, lf = d["listenbrainz"], d["lastfm"]
    return {
        "listenbrainz": {
            "enabled": lb["enabled"],
            "hasToken": bool(lb["token"]),
        },
        "lastfm": {
            "enabled": lf["enabled"],
            "hasKeys": bool(lf["apiKey"] and lf["apiSecret"]),
            "connected": bool(lf["sessionKey"]),
            "username": lf["username"],
        },
    }
