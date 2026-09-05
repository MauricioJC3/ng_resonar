from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import deps
from .cache import make_cache
from .config import settings
from .db import dispose_engine, init_engine
from .routers import (
    auth as auth_router,
    download,
    history as history_router,
    lyrics,
    playlists as playlists_router,
    recommendations as recs_router,
    search,
    settings as settings_router,
    sponsorblock,
    stream,
    video,
    videolib,
)
from .services import (
    audiobatch,
    history as history_service,
    playlists as playlists_service,
)
from .services.videolib import cleanup_partials


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_partials()
    playlists_service.ensure()
    history_service.ensure()
    audiobatch.cleanup_old()
    deps.cache = make_cache()
    deps.http = httpx.AsyncClient(
        follow_redirects=True,
        timeout=httpx.Timeout(connect=15.0, read=None, write=30.0, pool=15.0),
        headers={"User-Agent": "Mozilla/5.0"},
    )
    init_engine()
    if settings.redis_url:
        deps.redis = aioredis.from_url(
            settings.redis_url, decode_responses=True
        )
    try:
        yield
    finally:
        await deps.http.aclose()
        if deps.redis is not None:
            await deps.redis.aclose()
        dispose_engine()


app = FastAPI(title="Resonar API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(stream.router, prefix="/api")
app.include_router(video.router, prefix="/api")
app.include_router(videolib.router, prefix="/api")
app.include_router(sponsorblock.router, prefix="/api")
app.include_router(lyrics.router, prefix="/api")
app.include_router(playlists_router.router, prefix="/api")
app.include_router(history_router.router, prefix="/api")
app.include_router(recs_router.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(download.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"ok": True}
