from fastapi import APIRouter, Query

from ..config import settings
from ..deps import get_cache
from ..services import ytmusic

router = APIRouter(tags=["search"])


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1),
    type: str = Query("songs", pattern="^(songs|videos|albums|artists|playlists|)$"),
    limit: int = Query(25, ge=1, le=50),
):
    cache = get_cache()
    key = f"search:{type}:{limit}:{q.lower().strip()}"
    hit = await cache.get(key)
    if hit is not None:
        return {"results": hit}
    results = await ytmusic.search(q, type, limit)
    await cache.set(key, results, settings.search_cache_ttl)
    return {"results": results}


@router.get("/suggest")
async def suggest(q: str = Query(..., min_length=1)):
    cache = get_cache()
    key = f"suggest:{q.lower().strip()}"
    hit = await cache.get(key)
    if hit is not None:
        return {"suggestions": hit}
    suggestions = await ytmusic.suggestions(q)
    await cache.set(key, suggestions, settings.suggest_cache_ttl)
    return {"suggestions": suggestions}


@router.get("/related/{video_id}")
async def related(video_id: str, limit: int = Query(25, ge=1, le=50)):
    return {"results": await ytmusic.related(video_id, limit)}


@router.get("/home")
async def home():
    cache = get_cache()
    hit = await cache.get("home:music")
    if hit is not None:
        return {"results": hit}
    results = await ytmusic.home()
    await cache.set("home:music", results, 1800)
    return {"results": results}
