import time

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from ..services import appsettings, scrobble

router = APIRouter(tags=["settings"])


@router.get("/settings")
async def get_settings():
    return appsettings.redacted()


@router.put("/settings")
async def put_settings(patch: dict):
    appsettings.update(patch)
    return appsettings.redacted()


class TrackBody(BaseModel):
    track: dict
    listenedAt: int | None = None


@router.post("/scrobble/now-playing", status_code=202)
async def now_playing(body: TrackBody):
    await scrobble.now_playing(body.track)
    return {"ok": True}


@router.post("/scrobble/submit", status_code=202)
async def submit(body: TrackBody):
    await scrobble.submit(body.track, body.listenedAt or int(time.time()))
    return {"ok": True}


@router.get("/scrobble/lastfm/auth-url")
async def lastfm_auth_url(callback: str = Query(...)):
    cfg = appsettings.load()["lastfm"]
    if not cfg["apiKey"]:
        raise HTTPException(status_code=400, detail="guarda primero la API key de Last.fm")
    url = f"https://www.last.fm/api/auth/?api_key={cfg['apiKey']}&cb={callback}"
    return {"url": url}


@router.get("/scrobble/lastfm/callback", response_class=HTMLResponse)
async def lastfm_callback(token: str = Query(...)):
    try:
        data = await scrobble.lastfm_call("auth.getSession", {"token": token})
        session = data["session"]
        appsettings.set_lastfm_session(session["key"], session.get("name", ""))
        msg = f"Conectado como {session.get('name', '')}. Ya puedes cerrar esta pestaña."
    except Exception as exc:  # noqa: BLE001
        msg = f"No se pudo conectar con Last.fm: {exc}"
    return HTMLResponse(
        f"<!doctype html><meta charset=utf-8>"
        f"<body style='font-family:system-ui;background:#0E1414;color:#E6EDEB;"
        f"display:grid;place-items:center;height:100vh;margin:0'>"
        f"<p>{msg}</p>"
    )
