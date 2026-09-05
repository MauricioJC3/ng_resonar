"""Send now-playing / listens to ListenBrainz and Last.fm. Best-effort.

The caller loads the per-user settings blob (``appsettings.load(db, user_id)``)
and passes it in as ``cfg`` so this module stays free of DB access and works
with the credentials of whichever user made the request.
"""

from __future__ import annotations

import hashlib
import time

from ..deps import get_http

LB_ROOT = "https://api.listenbrainz.org/1/submit-listens"
LFM_ROOT = "https://ws.audioscrobbler.com/2.0/"


def _meta(track: dict) -> tuple[str, str, str]:
    artists = track.get("artists") or []
    artist = artists[0] if artists else (track.get("uploader") or "")
    return artist, track.get("title") or "", track.get("album") or ""


# --------------------------------------------------------------------------- #
# ListenBrainz
# --------------------------------------------------------------------------- #


async def _lb(
    cfg: dict, track: dict, listen_type: str, listened_at: int | None
) -> None:
    lb = cfg["listenbrainz"]
    if not lb["enabled"] or not lb["token"]:
        return
    artist, title, album = _meta(track)
    if not artist or not title:
        return
    listen: dict = {
        "track_metadata": {"artist_name": artist, "track_name": title}
    }
    if album:
        listen["track_metadata"]["release_name"] = album
    if listen_type == "single":
        listen["listened_at"] = listened_at or int(time.time())

    try:
        await get_http().post(
            LB_ROOT,
            json={"listen_type": listen_type, "payload": [listen]},
            headers={"Authorization": f"Token {lb['token']}"},
            timeout=10,
        )
    except Exception:  # noqa: BLE001
        pass


# --------------------------------------------------------------------------- #
# Last.fm
# --------------------------------------------------------------------------- #


def _sign(params: dict, secret: str) -> str:
    base = "".join(f"{k}{params[k]}" for k in sorted(params)) + secret
    return hashlib.md5(base.encode("utf-8")).hexdigest()


async def lastfm_call(cfg: dict, method: str, extra: dict) -> dict:
    lf = cfg["lastfm"]
    params = {"method": method, "api_key": lf["apiKey"], **extra}
    params["api_sig"] = _sign(params, lf["apiSecret"])
    params["format"] = "json"
    res = await get_http().post(LFM_ROOT, data=params, timeout=10)
    return res.json()


async def _lfm(
    cfg: dict, track: dict, method: str, listened_at: int | None
) -> None:
    lf = cfg["lastfm"]
    if not lf["enabled"] or not lf["sessionKey"] or not lf["apiKey"]:
        return
    artist, title, album = _meta(track)
    if not artist or not title:
        return
    extra = {"artist": artist, "track": title, "sk": lf["sessionKey"]}
    if album:
        extra["album"] = album
    if method == "track.scrobble":
        extra["timestamp"] = str(listened_at or int(time.time()))
    try:
        await lastfm_call(cfg, method, extra)
    except Exception:  # noqa: BLE001
        pass


# --------------------------------------------------------------------------- #
# Public
# --------------------------------------------------------------------------- #


async def now_playing(cfg: dict, track: dict) -> None:
    await _lb(cfg, track, "playing_now", None)
    await _lfm(cfg, track, "track.updateNowPlaying", None)


async def submit(cfg: dict, track: dict, listened_at: int | None = None) -> None:
    ts = listened_at or int(time.time())
    await _lb(cfg, track, "single", ts)
    await _lfm(cfg, track, "track.scrobble", ts)
