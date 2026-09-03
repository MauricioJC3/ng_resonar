"""Process-wide singletons wired up in the app lifespan (see main.py)."""

from __future__ import annotations

import httpx

from .cache import Cache

cache: Cache | None = None
http: httpx.AsyncClient | None = None


def get_cache() -> Cache:
    assert cache is not None, "cache not initialised"
    return cache


def get_http() -> httpx.AsyncClient:
    assert http is not None, "http client not initialised"
    return http
