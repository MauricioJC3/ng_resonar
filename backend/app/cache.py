"""Tiny async cache abstraction with a Redis backend and an in-process fallback."""

from __future__ import annotations

import json
import time
from typing import Any

from .config import settings


class Cache:
    async def get(self, key: str) -> Any | None:  # pragma: no cover - interface
        raise NotImplementedError

    async def set(self, key: str, value: Any, ttl: int) -> None:  # pragma: no cover
        raise NotImplementedError

    async def delete(self, key: str) -> None:  # pragma: no cover - interface
        raise NotImplementedError


class MemoryCache(Cache):
    def __init__(self) -> None:
        self._data: dict[str, tuple[Any, float | None]] = {}

    async def get(self, key: str) -> Any | None:
        item = self._data.get(key)
        if item is None:
            return None
        value, expires = item
        if expires is not None and expires < time.time():
            self._data.pop(key, None)
            return None
        return value

    async def set(self, key: str, value: Any, ttl: int) -> None:
        self._data[key] = (value, time.time() + ttl if ttl else None)

    async def delete(self, key: str) -> None:
        self._data.pop(key, None)


class RedisCache(Cache):
    def __init__(self, url: str) -> None:
        import redis.asyncio as redis

        self._redis = redis.from_url(url, decode_responses=True)

    async def get(self, key: str) -> Any | None:
        raw = await self._redis.get(key)
        return json.loads(raw) if raw is not None else None

    async def set(self, key: str, value: Any, ttl: int) -> None:
        await self._redis.set(key, json.dumps(value), ex=ttl or None)

    async def delete(self, key: str) -> None:
        await self._redis.delete(key)


def make_cache() -> Cache:
    if settings.redis_url:
        try:
            return RedisCache(settings.redis_url)
        except Exception:  # noqa: BLE001 - fall back to memory if redis is unavailable
            return MemoryCache()
    return MemoryCache()
