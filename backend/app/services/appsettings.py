"""Per-user settings (scrobbling credentials) persisted to Postgres (design D3).

Same nested shape the SPA already sends and receives; it now lives in the
``user_settings`` row for ``current_user`` instead of a shared JSON file.

The typed columns are authoritative (design D3):

    ``lastfm_session_key``  <->  ``lastfm.sessionKey``
    ``lastfm_username``     <->  ``lastfm.username``
    ``listenbrainz_token``  <->  ``listenbrainz.token``
    ``scrobble_enabled``    <->  ``lastfm.enabled``   (Last.fm is the scrobble target)

``user_settings.data`` (JSONB) holds only the genuinely-other appsettings keys
that have no dedicated column: ``lastfm.apiKey``, ``lastfm.apiSecret`` and
``listenbrainz.enabled``. There is no write-only mirror anymore -- ``load`` reads
the columns back and ``update`` writes them directly.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..repos import user_settings as user_settings_repo

_SECRET_FIELDS = {"token", "apiKey", "apiSecret", "sessionKey"}


def _shape(
    *,
    lb_enabled: bool,
    lb_token: str,
    lf_enabled: bool,
    lf_api_key: str,
    lf_api_secret: str,
    lf_session_key: str,
    lf_username: str,
) -> dict:
    return {
        "listenbrainz": {
            "enabled": bool(lb_enabled),
            "token": lb_token or "",
        },
        "lastfm": {
            "enabled": bool(lf_enabled),
            "apiKey": lf_api_key or "",
            "apiSecret": lf_api_secret or "",
            "sessionKey": lf_session_key or "",
            "username": lf_username or "",
        },
    }


def _from_row(row) -> dict:
    """Reconstruct the nested SPA shape: typed columns win, blob fills the rest."""
    extra = row.data if isinstance(row.data, dict) else {}
    lf_extra = extra.get("lastfm") if isinstance(extra.get("lastfm"), dict) else {}
    lb_extra = (
        extra.get("listenbrainz")
        if isinstance(extra.get("listenbrainz"), dict)
        else {}
    )
    return _shape(
        lb_enabled=lb_extra.get("enabled", False),
        lb_token=row.listenbrainz_token or "",
        lf_enabled=row.scrobble_enabled,
        lf_api_key=lf_extra.get("apiKey", ""),
        lf_api_secret=lf_extra.get("apiSecret", ""),
        lf_session_key=row.lastfm_session_key or "",
        lf_username=row.lastfm_username or "",
    )


def _write(row, data: dict) -> None:
    lf, lb = data["lastfm"], data["listenbrainz"]
    row.lastfm_session_key = lf["sessionKey"] or None
    row.lastfm_username = lf["username"] or None
    row.listenbrainz_token = lb["token"] or None
    row.scrobble_enabled = bool(lf["enabled"])
    # JSONB is not a Mutable type -- always reassign so SQLAlchemy sees the change.
    row.data = {
        "lastfm": {"apiKey": lf["apiKey"], "apiSecret": lf["apiSecret"]},
        "listenbrainz": {"enabled": bool(lb["enabled"])},
    }


def load(db: Session, user_id: int) -> dict:
    row = user_settings_repo.get_or_create(db, user_id)
    return _from_row(row)


def update(db: Session, user_id: int, patch: dict) -> dict:
    """Merge a patch. Secret fields are only overwritten when a non-empty value
    is supplied, so the UI can send blanks without wiping them."""
    row = user_settings_repo.get_or_create(db, user_id)
    data = _from_row(row)
    for group, vals in (patch or {}).items():
        if group not in data or not isinstance(vals, dict):
            continue
        for key, value in vals.items():
            if key not in data[group]:
                continue
            if key in _SECRET_FIELDS and (value is None or value == ""):
                continue
            data[group][key] = value
    _write(row, data)
    db.flush()
    return data


def set_lastfm_session(
    db: Session, user_id: int, session_key: str, username: str
) -> None:
    row = user_settings_repo.get_or_create(db, user_id)
    data = _from_row(row)
    data["lastfm"]["sessionKey"] = session_key
    data["lastfm"]["username"] = username
    data["lastfm"]["enabled"] = True
    _write(row, data)
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
