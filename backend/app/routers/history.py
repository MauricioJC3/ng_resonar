from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user
from ..models import User
from ..services import history

router = APIRouter(tags=["history"])


class HistoryEntry(BaseModel):
    """Stored history entry shape (docs / type parity)."""

    videoId: str
    title: str
    artist: str | None = None
    thumbnail: str | None = None
    kind: Literal["song", "video"] = "song"
    playedAt: int
    playCount: int = 1
    source: str | None = None


class HistoryBody(BaseModel):
    """POST body - no playedAt / playCount (server stamps them)."""

    videoId: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=500)
    artist: str | None = Field(default=None, max_length=500)
    thumbnail: str | None = Field(default=None, max_length=1000)
    kind: Literal["song", "video"] = "song"
    source: str | None = Field(default=None, max_length=32)


@router.get("/history")
async def get_history(
    limit: int = Query(100, ge=1, le=800),
    kind: Literal["song", "video"] | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    results = await run_in_threadpool(
        history.list_entries, db, user.id, limit, kind
    )
    return {"results": results}


@router.post("/history")
async def post_history(
    body: HistoryBody,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    return await run_in_threadpool(
        history.add, db, user.id, body.model_dump()
    )


@router.delete("/history")
async def delete_history(
    kind: Literal["song", "video"] | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    await run_in_threadpool(history.clear, db, user.id, kind)
    return {"ok": True}
