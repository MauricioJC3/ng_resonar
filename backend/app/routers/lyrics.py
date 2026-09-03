import re

from fastapi import APIRouter, Query

from ..deps import get_cache, get_http

router = APIRouter(tags=["lyrics"])

_LRC_RE = re.compile(r"\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]")
_UA = {"User-Agent": "Resonar/0.1 (self-hosted music player)"}


def _parse_lrc(text: str) -> list[dict]:
    lines: list[dict] = []
    for raw in text.splitlines():
        stamps = list(_LRC_RE.finditer(raw))
        if not stamps:
            continue
        content = raw[stamps[-1].end():].strip()
        for m in stamps:
            t = int(m.group(1)) * 60 + float(m.group(2))
            lines.append({"time": round(t, 2), "text": content})
    lines.sort(key=lambda x: x["time"])
    return lines


@router.get("/lyrics")
async def lyrics(
    artist: str = Query(""),
    title: str = Query(..., min_length=1),
    album: str = Query(""),
    duration: int = Query(0, ge=0),
):
    cache = get_cache()
    key = f"lrc:{artist.lower()}|{title.lower()}|{album.lower()}|{duration}"
    hit = await cache.get(key)
    if hit is not None:
        return hit

    client = get_http()
    result: dict = {"synced": [], "plain": None, "source": None}
    try:
        params = {"artist_name": artist or title, "track_name": title}
        if album:
            params["album_name"] = album
        if duration:
            params["duration"] = duration

        data = None
        res = await client.get("https://lrclib.net/api/get", params=params, headers=_UA)
        if res.status_code == 200:
            data = res.json()
        else:
            res2 = await client.get(
                "https://lrclib.net/api/search",
                params={"track_name": title, "artist_name": artist},
                headers=_UA,
            )
            if res2.status_code == 200:
                arr = res2.json()
                if arr:
                    data = arr[0]

        if data:
            result["plain"] = data.get("plainLyrics")
            result["synced"] = _parse_lrc(data.get("syncedLyrics") or "")
            result["source"] = "lrclib"
    except Exception:  # noqa: BLE001 - lyrics are best-effort
        pass

    await cache.set(key, result, 86_400)
    return result
