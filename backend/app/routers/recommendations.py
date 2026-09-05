"""History-seeded music recommendations (thin router; logic lives in the service)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user, get_cache
from ..models import User
from ..services.recommend import recommend

router = APIRouter(tags=["recommendations"])


@router.get("/recommendations")
async def get_recommendations(
    limit: int = Query(30, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    cache = get_cache()
    return {"results": await recommend(cache, db, user.id, limit)}
