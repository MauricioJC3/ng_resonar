"""Per-user favorites (thin router; logic lives in ``repos/favorites.py``).

Mounted under ``Depends(current_user)`` in ``main.py`` — every route requires a
valid session and only ever touches the caller's rows.
"""

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import User
from ..repos import favorites as favorites_repo

router = APIRouter(tags=["favorites"])


class FavoriteBody(BaseModel):
    track: dict


@router.get("/favorites")
async def list_favorites(
    db: Session = Depends(get_db), user: User = Depends(current_user)
):
    results = await run_in_threadpool(favorites_repo.list_, db, user.id)
    return {"results": results}


@router.post("/favorites")
async def add_favorite(
    body: FavoriteBody,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    added = await run_in_threadpool(
        favorites_repo.add, db, user.id, body.track
    )
    return {"ok": True, "added": added}


@router.delete("/favorites/{track_id}")
async def remove_favorite(
    track_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    removed = await run_in_threadpool(
        favorites_repo.remove, db, user.id, track_id
    )
    return {"ok": True, "removed": removed}
