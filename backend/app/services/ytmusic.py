"""Search / discovery via the unofficial YouTube Music API (no auth needed)."""

from __future__ import annotations

import re

from fastapi.concurrency import run_in_threadpool

_client = None


def _yt():
    global _client
    if _client is None:
        from ytmusicapi import YTMusic

        _client = YTMusic()
    return _client


def _upscale(url: str | None) -> str | None:
    # ytmusic thumbnail URLs end with "=w120-h120-l90-rj"; bump to something crisp.
    return re.sub(r"=w\d+-h\d+", "=w544-h544", url) if url else url


def _thumb(item: dict) -> str | None:
    thumbs = item.get("thumbnails") or item.get("thumbnail") or []
    if not thumbs:
        return None
    best = sorted(thumbs, key=lambda t: t.get("width", 0))[-1]
    return _upscale(best.get("url"))


def _artists(item: dict) -> list[str]:
    out = []
    for a in item.get("artists") or []:
        name = a.get("name")
        # get_home sprinkles fake "574M plays" entries into the artists list
        if name and not (a.get("id") is None and "plays" in name.lower()):
            out.append(name)
    return out


def _norm(item: dict) -> dict:
    album = item.get("album")
    return {
        "id": item.get("videoId"),
        "title": item.get("title"),
        "artists": _artists(item),
        "album": album.get("name") if isinstance(album, dict) else album,
        "duration": item.get("duration") or item.get("length"),
        "durationSeconds": item.get("duration_seconds"),
        "thumbnail": _thumb(item),
    }


def _search_sync(query: str, filter_: str | None, limit: int) -> list[dict]:
    raw = _yt().search(query, filter=filter_ or None, limit=limit)
    out: list[dict] = []
    for item in raw:
        if item.get("resultType") in ("song", "video") and item.get("videoId"):
            out.append(_norm(item))
    return out


def _related_sync(video_id: str, limit: int) -> list[dict]:
    yt = _yt()
    # Preferred: the autoplay "radio" for this track.
    for kwargs in (
        {"videoId": video_id, "radio": True, "limit": limit},
        {"videoId": video_id, "playlistId": f"RDAMVM{video_id}", "limit": limit},
    ):
        try:
            watch = yt.get_watch_playlist(**kwargs)
            tracks = [
                _norm(t)
                for t in watch.get("tracks", [])
                if t.get("videoId") and t.get("videoId") != video_id
            ]
            if tracks:
                return tracks
        except Exception:  # noqa: BLE001 - ytmusicapi internals are brittle
            continue

    # Fallback: search by the seed track's title + artist.
    try:
        song = yt.get_song(video_id)
        details = song.get("videoDetails", {})
        query = " ".join(
            p for p in (details.get("author"), details.get("title")) if p
        )
        if query:
            return [
                item
                for item in _search_sync(query, "songs", limit)
                if item["id"] != video_id
            ]
    except Exception:  # noqa: BLE001
        pass
    return []


async def search(query: str, filter_: str = "songs", limit: int = 25) -> list[dict]:
    return await run_in_threadpool(_search_sync, query, filter_, limit)


async def suggestions(query: str) -> list[str]:
    return await run_in_threadpool(_yt().get_search_suggestions, query)


async def related(video_id: str, limit: int = 25) -> list[dict]:
    return await run_in_threadpool(_related_sync, video_id, limit)


def _playlist_sync(list_id: str, limit: int) -> dict:
    yt = _yt()
    if list_id.startswith("MPREb_"):  # album browseId
        alb = yt.get_album(list_id)
        tracks = [_norm(t) for t in alb.get("tracks", []) if t.get("videoId")]
        return {"title": alb.get("title"), "tracks": tracks}
    pl = yt.get_playlist(list_id, limit=limit)
    tracks = [_norm(t) for t in pl.get("tracks", []) if t.get("videoId")]
    return {"title": pl.get("title"), "tracks": tracks}


async def playlist(list_id: str, limit: int = 300) -> dict:
    return await run_in_threadpool(_playlist_sync, list_id, limit)


def _home_sync() -> list[dict]:
    yt = _yt()
    seen: set[str] = set()
    out: list[dict] = []
    for section in yt.get_home(limit=8):
        for item in section.get("contents") or []:
            vid = item.get("videoId")
            if not vid or vid in seen:
                continue
            seen.add(vid)
            out.append(_norm(item))
    if not out:
        return _search_sync("top hits", "songs", 30)
    return out


async def home() -> list[dict]:
    return await run_in_threadpool(_home_sync)
