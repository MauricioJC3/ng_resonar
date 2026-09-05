"""History-seeded music recommendations (thin router; logic lives in the service)."""

from fastapi import APIRouter, Query

from ..deps import get_cache
from ..services.recommend import recommend

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations")
async def get_recommendations(limit: int = Query(30, ge=1, le=50)):
    cache = get_cache()
    return {"results": await recommend(cache, limit)}
