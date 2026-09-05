"""Brute-force login throttle backed by Redis counters (design D9).

Rolling 900 s window. 7 failures per username OR 30 failures per client IP ->
429 for the remaining window (temporary, never permanent). Counters are cleared
on a successful login. Small random jitter is added on failure.
"""

from __future__ import annotations

import asyncio
import random

from fastapi import HTTPException, Request, status

from . import deps

WINDOW_SECONDS = 900
MAX_FAILURES_PER_USERNAME = 7
MAX_FAILURES_PER_IP = 30
FAILURE_JITTER_MAX = 0.120  # seconds


def client_ip(request: Request) -> str:
    """Resolve the client IP: CF-Connecting-IP -> first XFF hop -> 'unknown'.

    ``request.client.host`` is never trusted (always the proxy in deployment).
    """
    cf = request.headers.get("CF-Connecting-IP")
    if cf and cf.strip():
        return cf.strip()
    xff = request.headers.get("X-Forwarded-For")
    if xff and xff.split(",")[0].strip():
        return xff.split(",")[0].strip()
    return "unknown"


def _user_key(username: str) -> str:
    return f"login_fail:user:{username.strip().lower()}"


def _ip_key(ip: str) -> str:
    return f"login_fail:ip:{ip}"


async def enforce(username: str, ip: str) -> None:
    """Raise 429 if either counter is at/over its threshold."""
    r = deps.get_redis()
    user_key, ip_key = _user_key(username), _ip_key(ip)
    raw_user = await r.get(user_key)
    raw_ip = await r.get(ip_key)
    user_hits = int(raw_user) if raw_user else 0
    ip_hits = int(raw_ip) if raw_ip else 0

    if user_hits >= MAX_FAILURES_PER_USERNAME or ip_hits >= MAX_FAILURES_PER_IP:
        over_key = user_key if user_hits >= MAX_FAILURES_PER_USERNAME else ip_key
        ttl = await r.ttl(over_key)
        retry_after = ttl if isinstance(ttl, int) and ttl > 0 else WINDOW_SECONDS
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )


async def record_failure(username: str, ip: str) -> None:
    r = deps.get_redis()
    for key in (_user_key(username), _ip_key(ip)):
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, WINDOW_SECONDS)
    await asyncio.sleep(random.uniform(0, FAILURE_JITTER_MAX))


async def record_success(username: str, ip: str) -> None:
    r = deps.get_redis()
    await r.delete(_user_key(username), _ip_key(ip))
