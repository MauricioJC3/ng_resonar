from fastapi import APIRouter, HTTPException, Request

from ..deps import get_cache, get_http
from ..services import ytdlp
from ..services.proxy import proxy_media

router = APIRouter(tags=["stream"])


async def _resolved(video_id: str, *, force: bool = False) -> dict:
    cache = get_cache()
    key = f"stream:{video_id}"
    if not force:
        cached = await cache.get(key)
        if cached:
            return cached
    try:
        data = await ytdlp.resolve(video_id)
    except Exception as exc:  # noqa: BLE001 - surface a clean 502 to the client
        raise HTTPException(status_code=502, detail=f"stream resolve failed: {exc}") from exc
    await cache.set(key, data, data.get("ttl", 18_000))
    return data


@router.get("/stream/{video_id}")
async def stream(video_id: str, request: Request):
    return await proxy_media(
        get_http(),
        request,
        lambda force=False: _resolved(video_id, force=force),
    )
