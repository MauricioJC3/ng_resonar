"""Per-user settings (scrobbling credentials) persisted to Postgres (design D3).

Same nested shape the SPA already sends and receives; it now lives in the
``user_settings`` row for ``current_user`` instead of a shared JSON file. The
dedicated columns (``lastfm_session_key`` etc.) are kept in sync with the blob
for schema fidelity, but the blob in ``user_settings.data`` is the source of
truth for the API shapes.
"""

from __future__ import annotations

import copy

from sqlalchemy.orm import Session

from ..repos import user_settings as user_settings_repo

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

_SECRET_FIELDS = {"token", "apiKey", "apiSecret", "sessionKey"}


def _merge_defaults(data: dict) -> dict:
    out = copy.deepcopy(_DEFAULT)
    for group, vals in (data or {}).items():
        if group in out and isinstance(vals, dict):
            out[group].update(
                {k: v for k, v in vals.items() if k in out[group]}
            )
    return out


def _sync_columns(row, data: dict) -> None:
    lf, lb = data["lastfm"], data["listenbrainz"]
    row.lastfm_session_key = lf["sessionKey"] or None
    row.lastfm_username = lf["username"] or None
    row.listenbrainz_token = lb["token"] or None
    row.scrobble_enabled = bool(lf["enabled"] or lb["enabled"])


def load(db: Session, user_id: int) -> dict:
    row = user_settings_repo.get_or_create(db, user_id)
    return _merge_defaults(row.data)


def update(db: Session, user_id: int, patch: dict) -> dict:
    """Merge a patch. Secret fields are only overwritten when a non-empty value
    is supplied, so the UI can send blanks without wiping them."""
    row = user_settings_repo.get_or_create(db, user_id)
    data = _merge_defaults(row.data)
    for group, vals in (patch or {}).items():
        if group not in data or not isinstance(vals, dict):
            continue
        for key, value in vals.items():
            if key not in data[group]:
                continue
            if key in _SECRET_FIELDS and (value is None or value == ""):
                continue
            data[group][key] = value
    row.data = data
    _sync_columns(row, data)
    db.flush()
    return data


def set_lastfm_session(
    db: Session, user_id: int, session_key: str, username: str
) -> None:
    row = user_settings_repo.get_or_create(db, user_id)
    data = _merge_defaults(row.data)
    data["lastfm"]["sessionKey"] = session_key
    data["lastfm"]["username"] = username
    data["lastfm"]["enabled"] = True
    row.data = data
    _sync_columns(row, data)
    db.flush()


def redacted(db: Session, user_id: int) -> dict:
    d = load(db, user_id)
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
