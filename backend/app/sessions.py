"""Opaque server-side sessions stored in Redis (design D5).

Key layout:
  sess:<sha256hex(token)>  HASH {user_id, created_at, last_seen, remember, ip, ua}
                           EXPIRE = idle TTL
  user_sessions:<uid>      SET of sha256hex(token); EXPIRE = longest absolute cap

The cookie carries only ``secrets.token_urlsafe(32)``. Redis stores just the
SHA-256 hex of that token, so a Redis dump is not directly replayable.
"""

from __future__ import annotations

import hashlib
import secrets
import time

from . import deps
from .config import settings

TOKEN_BYTES = 32
SLIDING_REFRESH_AFTER = 300  # seconds; one Redis write per 5 min of activity


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _ttls(remember: bool) -> tuple[int, int]:
    """Return (idle_ttl, absolute_cap) for the session mode."""
    if remember:
        return (
            settings.session_remember_idle_ttl,
            settings.session_remember_absolute_ttl,
        )
    return settings.session_idle_ttl, settings.session_absolute_ttl


def cookie_max_age(remember: bool) -> int | None:
    """Persistent cookie (Max-Age = absolute cap) for remember-me, else a
    session cookie (no Max-Age)."""
    return _ttls(remember)[1] if remember else None


async def create(
    user_id: int,
    *,
    remember: bool = False,
    ip: str | None = None,
    ua: str | None = None,
) -> str:
    """Create a session and return the raw (unhashed) token for the cookie."""
    token = secrets.token_urlsafe(TOKEN_BYTES)
    h = _token_hash(token)
    now = int(time.time())
    idle_ttl, abs_cap = _ttls(remember)
    r = deps.get_redis()

    sess_key = f"sess:{h}"
    await r.hset(
        sess_key,
        mapping={
            "user_id": str(user_id),
            "created_at": str(now),
            "last_seen": str(now),
            "remember": "1" if remember else "0",
            "ip": ip or "",
            "ua": (ua or "")[:512],
        },
    )
    await r.expire(sess_key, idle_ttl)

    set_key = f"user_sessions:{user_id}"
    await r.sadd(set_key, h)
    await r.expire(set_key, abs_cap)
    return token


async def validate(token: str) -> dict | None:
    """Return the session hash (str->str) or ``None`` if missing/expired/capped.

    Slides the idle TTL only when the last write was more than
    ``SLIDING_REFRESH_AFTER`` seconds ago. Enforces the absolute cap
    independently of activity.
    """
    r = deps.get_redis()
    h = _token_hash(token)
    sess_key = f"sess:{h}"
    data = await r.hgetall(sess_key)
    if not data:
        return None

    now = int(time.time())
    remember = data.get("remember") == "1"
    idle_ttl, abs_cap = _ttls(remember)

    created_at = int(data.get("created_at", now))
    if now - created_at > abs_cap:
        await destroy(token)
        return None

    last_seen = int(data.get("last_seen", now))
    if now - last_seen > SLIDING_REFRESH_AFTER:
        await r.hset(sess_key, "last_seen", str(now))
        await r.expire(sess_key, idle_ttl)

    return data


async def destroy(token: str) -> None:
    r = deps.get_redis()
    h = _token_hash(token)
    data = await r.hgetall(f"sess:{h}")
    await r.delete(f"sess:{h}")
    uid = data.get("user_id")
    if uid:
        await r.srem(f"user_sessions:{uid}", h)


async def destroy_all(user_id: int, *, except_token: str | None = None) -> None:
    """Invalidate every session for ``user_id`` (optionally keeping one)."""
    r = deps.get_redis()
    set_key = f"user_sessions:{user_id}"
    keep = _token_hash(except_token) if except_token else None
    members = await r.smembers(set_key)
    for h in members:
        if h == keep:
            continue
        await r.delete(f"sess:{h}")
        await r.srem(set_key, h)
    if keep is None:
        await r.delete(set_key)
