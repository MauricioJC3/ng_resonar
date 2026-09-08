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
    vid = item.get("videoId")
    # ytmusic search/watch responses drop the thumbnail array on some items
    # (podcast/video results, sparse "watch playlist" entries). Every YouTube
    # video has a static CDN thumbnail keyed by id — use it as a floor so the
    # UI never shows a blank tile.
    thumb = _thumb(item)
    if not thumb and vid:
        thumb = f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
    return {
        "id": vid,
        "title": item.get("title"),
        "artists": _artists(item),
        "album": album.get("name") if isinstance(album, dict) else album,
        "duration": item.get("duration") or item.get("length"),
        "durationSeconds": item.get("duration_seconds"),
        "thumbnail": thumb,
    }


def _search_sync(query: str, filter_: str | None, limit: int) -> list[dict]:
    raw = _yt().search(query, filter=filter_ or None, limit=limit)
    out: list[dict] = []
    for item in raw:
        if item.get("resultType") in ("song", "video") and item.get("videoId"):
            out.append(_norm(item))
    return out


def _norm_album(item: dict) -> dict:
    return {
        "browseId": item.get("browseId"),
        "playlistId": item.get("playlistId") or item.get("audioPlaylistId"),
        "title": item.get("title"),
        "artists": _artists(item),
        "year": item.get("year"),
        "type": item.get("type"),  # "Album" / "Single" / "EP"
        "thumbnail": _thumb(item),
    }


def _norm_artist(item: dict) -> dict:
    return {
        "browseId": item.get("browseId"),
        "name": item.get("artist") or item.get("title"),
        "thumbnail": _thumb(item),
    }


def _search_meta_sync(query: str, filter_: str, limit: int) -> list[dict]:
    """Search that keeps album / artist cards instead of playable tracks."""
    raw = _yt().search(query, filter=filter_, limit=limit)
    norm = _norm_album if filter_ == "albums" else _norm_artist
    out: list[dict] = []
    for item in raw:
        if item.get("browseId"):
            out.append(norm(item))
    return out


def _album_sync(browse_id: str) -> dict:
    alb = _yt().get_album(browse_id)
    alb_artists = _artists(alb)
    alb_thumb = _thumb(alb)
    tracks: list[dict] = []
    for t in alb.get("tracks", []) or []:
        if not t.get("videoId"):
            continue
        n = _norm(t)
        # Album track rows routinely drop the album name / thumbnail / artist.
        n["album"] = n.get("album") or alb.get("title")
        n["thumbnail"] = n.get("thumbnail") or alb_thumb
        if not n.get("artists"):
            n["artists"] = alb_artists
        tracks.append(n)
    return {
        "browseId": browse_id,
        "title": alb.get("title"),
        "artists": alb_artists,
        "year": alb.get("year"),
        "duration": alb.get("duration"),
        "trackCount": alb.get("trackCount") or len(tracks),
        "thumbnail": alb_thumb,
        "tracks": tracks,
    }


def _artist_sync(browse_id: str) -> dict:
    yt = _yt()
    a = yt.get_artist(browse_id)

    songs_sec = a.get("songs") or {}
    top_songs: list[dict] = []

    # get_artist only inlines ~5 songs. When the artist's "songs" playlist id is
    # present, pull it for a fuller "Populares" list; fall back to the inline
    # results if that lookup fails (ytmusicapi internals are brittle).
    songs_playlist = songs_sec.get("browseId")
    if songs_playlist:
        try:
            pl = yt.get_playlist(songs_playlist, limit=10)
            for t in pl.get("tracks", []) or []:
                if t.get("videoId"):
                    top_songs.append(_norm(t))
        except Exception:  # noqa: BLE001
            top_songs = []

    if not top_songs:
        for t in songs_sec.get("results", []) or []:
            if t.get("videoId"):
                top_songs.append(_norm(t))

    top_songs = top_songs[:10]

    def _cards(key: str) -> list[dict]:
        sec = a.get(key) or {}
        return [
            _norm_album(it)
            for it in sec.get("results", []) or []
            if it.get("browseId")
        ]

    return {
        "browseId": browse_id,
        "name": a.get("name"),
        "thumbnail": _thumb(a),
        "description": a.get("description"),
        "topSongs": top_songs,
        "albums": _cards("albums"),
        "singles": _cards("singles"),
    }


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
    if filter_ in ("albums", "artists"):
        return await run_in_threadpool(_search_meta_sync, query, filter_, limit)
    return await run_in_threadpool(_search_sync, query, filter_, limit)


async def album(browse_id: str) -> dict:
    return await run_in_threadpool(_album_sync, browse_id)


async def artist(browse_id: str) -> dict:
    return await run_in_threadpool(_artist_sync, browse_id)


async def suggestions(query: str) -> list[str]:
    return await run_in_threadpool(_yt().get_search_suggestions, query)


async def related(video_id: str, limit: int = 25) -> list[dict]:
    return await run_in_threadpool(_related_sync, video_id, limit)


def _watch_mix_sync(list_id: str, seed_video_id: str | None, limit: int) -> dict:
    """YouTube / YT Music "Mix" and radio lists (``RD…``) are not static
    playlists — resolve them through the watch/radio endpoint instead."""
    yt = _yt()
    seed = seed_video_id
    if not seed:
        for pre in ("RDAMVM", "RDEM", "RD"):
            if list_id.startswith(pre) and len(list_id) - len(pre) == 11:
                seed = list_id[len(pre):]
                break

    for kwargs in (
        {"playlistId": list_id, "videoId": seed, "limit": limit},
        {"videoId": seed, "radio": True, "limit": limit},
        {"playlistId": list_id, "limit": limit},
    ):
        call = {k: v for k, v in kwargs.items() if v is not None}
        if "playlistId" not in call and "videoId" not in call:
            continue
        try:
            watch = yt.get_watch_playlist(**call)
            tracks = [
                _norm(t) for t in watch.get("tracks", []) if t.get("videoId")
            ]
            if tracks:
                return {
                    "title": watch.get("title") or "Mix de YouTube",
                    "tracks": tracks,
                }
        except Exception:  # noqa: BLE001 - ytmusicapi internals are brittle
            continue
    return {"title": None, "tracks": []}


def _playlist_sync(
    list_id: str, limit: int, seed_video_id: str | None = None
) -> dict:
    yt = _yt()
    if list_id.startswith("MPREb_"):  # album browseId
        alb = yt.get_album(list_id)
        tracks = [_norm(t) for t in alb.get("tracks", []) if t.get("videoId")]
        return {"title": alb.get("title"), "tracks": tracks}
    if list_id.startswith("RD"):  # Mix / radio — not a static playlist
        return _watch_mix_sync(list_id, seed_video_id, limit)
    pl = yt.get_playlist(list_id, limit=limit)
    tracks = [_norm(t) for t in pl.get("tracks", []) if t.get("videoId")]
    return {"title": pl.get("title"), "tracks": tracks}


async def playlist(
    list_id: str, limit: int = 300, seed_video_id: str | None = None
) -> dict:
    return await run_in_threadpool(
        _playlist_sync, list_id, limit, seed_video_id
    )


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
