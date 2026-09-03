from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services import importer, playlists

router = APIRouter(tags=["playlists"])


class CreateBody(BaseModel):
    name: str = ""
    fromUrl: str | None = None


class RenameBody(BaseModel):
    name: str


class TracksBody(BaseModel):
    tracks: list[dict] | None = None
    track: dict | None = None


class ReorderBody(BaseModel):
    ids: list[str]


@router.get("/playlists")
async def list_all():
    return {"results": playlists.list_playlists()}


@router.post("/playlists")
async def create(body: CreateBody):
    tracks = None
    name = body.name
    if body.fromUrl:
        res = await importer.import_url(body.fromUrl)
        tracks = res.get("tracks") or []
        if not name.strip():
            name = res.get("title") or "Playlist importada"
        if not tracks:
            raise HTTPException(status_code=422, detail="no se encontraron pistas en esa URL")
    return playlists.create(name, tracks)


@router.get("/playlists/{pid}")
async def get_one(pid: str):
    pl = playlists.get(pid)
    if not pl:
        raise HTTPException(status_code=404, detail="playlist not found")
    return pl


@router.patch("/playlists/{pid}")
async def rename(pid: str, body: RenameBody):
    pl = playlists.rename(pid, body.name)
    if not pl:
        raise HTTPException(status_code=404, detail="playlist not found")
    return pl


@router.delete("/playlists/{pid}")
async def remove(pid: str):
    return {"removed": playlists.delete(pid)}


@router.post("/playlists/{pid}/tracks")
async def add_tracks(pid: str, body: TracksBody):
    items = body.tracks or ([body.track] if body.track else [])
    pl = playlists.add_tracks(pid, items)
    if not pl:
        raise HTTPException(status_code=404, detail="playlist not found")
    return pl


@router.delete("/playlists/{pid}/tracks/{track_id}")
async def remove_track(pid: str, track_id: str):
    pl = playlists.remove_track(pid, track_id)
    if not pl:
        raise HTTPException(status_code=404, detail="playlist not found")
    return pl


@router.put("/playlists/{pid}/tracks")
async def reorder(pid: str, body: ReorderBody):
    pl = playlists.reorder(pid, body.ids)
    if not pl:
        raise HTTPException(status_code=404, detail="playlist not found")
    return pl
