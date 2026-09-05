"""Process-wide singletons wired up in the app lifespan (see main.py) plus the
auth dependencies (design D6)."""

from __future__ import annotations

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from redis.asyncio import Redis
from sqlalchemy.orm import Session

from . import sessions
from .cache import Cache
from .config import settings
from .db import get_db
from .models import User
from .models.user import ROLE_SUPERADMIN
from .repos import users as users_repo

cache: Cache | None = None
http: httpx.AsyncClient | None = None
redis: Redis | None = None

# Paths a user with must_change_password set is still allowed to reach.
_PW_EXEMPT = {"/api/auth/password", "/api/auth/logout", "/api/auth/me"}


def get_cache() -> Cache:
    assert cache is not None, "cache not initialised"
    return cache


def get_http() -> httpx.AsyncClient:
    assert http is not None, "http client not initialised"
    return http


def get_redis() -> Redis:
    assert redis is not None, "redis not initialised"
    return redis


async def current_user(
    request: Request, db: Session = Depends(get_db)
) -> User:
    cached = getattr(request.state, "user", None)
    if cached is not None:
        return cached

    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    sess = await sessions.validate(token)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired"
        )

    user = await run_in_threadpool(users_repo.get, db, int(sess["user_id"]))
    if user is None:
        await sessions.destroy(token)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired"
        )

    if user.must_change_password and request.url.path not in _PW_EXEMPT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "must_change_password"},
        )

    request.state.user = user
    return user


def require_superadmin(user: User = Depends(current_user)) -> User:
    if user.role != ROLE_SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin only"
        )
    return user
