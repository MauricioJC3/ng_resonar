from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

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
async def get_history(limit: int = Query(100, ge=1, le=800)):
    return {"results": history.list_entries(limit)}


@router.post("/history")
async def post_history(body: HistoryBody):
    return history.add(body.model_dump())


@router.delete("/history")
async def delete_history():
    history.clear()
    return {"ok": True}
