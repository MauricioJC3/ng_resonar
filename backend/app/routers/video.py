from fastapi import APIRouter, HTTPException, Query, Request

from ..config import settings
from ..deps import get_cache, get_http
from ..services import ytdlp, ytmusic
from ..services.proxy import proxy_media
from ._shared import VideoId

router = APIRouter(tags=["video"])


def _as_video_item(track: dict) -> dict:
    vid = track["id"]
    return {
        "id": vid,
        "title": track.get("title"),
        "uploader": ", ".join(track.get("artists") or []) or None,
        "duration": track.get("duration"),
        "durationSeconds": track.get("durationSeconds"),
        "views": None,
        "thumbnail": track.get("thumbnail")
        or f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
    }


@router.get("/videos/trending")
async def videos_trending():
    cache = get_cache()
    hit = await cache.get("home:videos")
    if hit is not None:
        return {"results": hit}
    results = [_as_video_item(t) for t in await ytmusic.home() if t.get("id")]
    await cache.set("home:videos", results, 1800)
    return {"results": results}


@router.get("/videos/info/{video_id}")
async def videos_info(video_id: VideoId):
    try:
        return await ytdlp.video_info(video_id)
    except Exception:  # noqa: BLE001
        return {
            "id": video_id,
            "title": video_id,
            "uploader": None,
            "duration": None,
            "durationSeconds": None,
            "views": None,
            "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        }


@router.get("/videos/search")
async def videos_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(24, ge=1, le=40),
):
    cache = get_cache()
    key = f"vsearch:{limit}:{q.lower().strip()}"
    hit = await cache.get(key)
    if hit is not None:
        return {"results": hit}
    results = await ytdlp.search_videos(q, limit)
    await cache.set(key, results, settings.search_cache_ttl)
    return {"results": results}


async def _resolved_video(video_id: str, *, force: bool = False) -> dict:
    cache = get_cache()
    key = f"vstream:{video_id}"
    if not force:
        cached = await cache.get(key)
        if cached:
            return cached
    try:
        data = await ytdlp.resolve_video(video_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"video resolve failed: {exc}") from exc
    await cache.set(key, data, data.get("ttl", 18_000))
    return data


@router.get("/videos/stream/{video_id}")
async def videos_stream(video_id: VideoId, request: Request):
    return await proxy_media(
        get_http(),
        request,
        lambda force=False: _resolved_video(video_id, force=force),
    )
