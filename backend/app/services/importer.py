"""Turn a YouTube / YT Music playlist or album URL into a list of tracks."""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

import yt_dlp
from fastapi.concurrency import run_in_threadpool

from . import ytmusic
from .ytdlp import _base_opts


def _extract_list_id(url: str) -> str | None:
    query = parse_qs(urlparse(url).query)
    if query.get("list"):
        return query["list"][0]
    m = re.search(r"/browse/(MPREb_[\w-]+)", url)
    if m:
        return m.group(1)
    m = re.search(r"/playlist/([\w-]+)", url)
    if m:
        return m.group(1)
    return None


def _ytdlp_playlist_sync(url: str, limit: int) -> dict:
    opts = {**_base_opts(), "extract_flat": True, "playlistend": limit}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    tracks: list[dict] = []
    for entry in info.get("entries") or []:
        vid = entry.get("id")
        if not vid:
            continue
        artist = entry.get("uploader") or entry.get("channel")
        tracks.append(
            {
                "id": vid,
                "title": entry.get("title"),
                "artists": [artist] if artist else [],
                "album": None,
                "duration": None,
                "durationSeconds": entry.get("duration"),
                "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
            }
        )
    return {"title": info.get("title"), "tracks": tracks}


async def import_url(url: str, limit: int = 300) -> dict:
    list_id = _extract_list_id(url)
    if list_id:
        try:
            res = await ytmusic.playlist(list_id, limit)
            if res.get("tracks"):
                return res
        except Exception:  # noqa: BLE001 - fall back to yt-dlp
            pass
    return await run_in_threadpool(_ytdlp_playlist_sync, url, limit)
