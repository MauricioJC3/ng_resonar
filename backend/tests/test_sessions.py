"""Redis session lifecycle (design D5; session-lifecycle / logout /
raw-token-never-stored reqs). Uses fakeredis, no Postgres."""

import asyncio

import pytest

from app import sessions
from app.config import settings


@pytest.fixture(autouse=True)
def _fixed_ttls(monkeypatch):
    monkeypatch.setattr(settings, "session_idle_ttl", 3600)
    monkeypatch.setattr(settings, "session_absolute_ttl", 7200)
    monkeypatch.setattr(settings, "session_remember_idle_ttl", 100_000)
    monkeypatch.setattr(settings, "session_remember_absolute_ttl", 200_000)


async def test_create_then_validate_returns_the_user_id(fake_redis):
    token = await sessions.create(42, ip="1.2.3.4", ua="pytest")
    data = await sessions.validate(token)
    assert data is not None
    assert data["user_id"] == "42"


async def test_raw_token_is_never_stored_in_redis(fake_redis):
    token = await sessions.create(7)
    keys = await fake_redis.keys("*")
    assert f"sess:{sessions._token_hash(token)}" in keys
    assert not any(token in k for k in keys)
    stored = await fake_redis.hgetall(f"sess:{sessions._token_hash(token)}")
    assert token not in stored.values()


async def test_sliding_refresh_is_skipped_within_300s(fake_redis):
    token = await sessions.create(1)
    key = f"sess:{sessions._token_hash(token)}"
    first_seen = (await fake_redis.hget(key, "last_seen"))
    await sessions.validate(token)
    assert (await fake_redis.hget(key, "last_seen")) == first_seen


async def test_sliding_refresh_applies_after_300s(fake_redis, monkeypatch):
    token = await sessions.create(1)
    key = f"sess:{sessions._token_hash(token)}"
    import time as _time

    stale = int(_time.time()) - 400
    await fake_redis.hset(key, "last_seen", str(stale))
    await sessions.validate(token)
    assert int(await fake_redis.hget(key, "last_seen")) > stale


async def test_idle_expiry_yields_none(fake_redis):
    token = await sessions.create(1)
    key = f"sess:{sessions._token_hash(token)}"
    await fake_redis.pexpire(key, 10)
    await asyncio.sleep(0.05)
    assert await sessions.validate(token) is None


async def test_absolute_cap_destroys_even_when_idle_fresh(fake_redis):
    token = await sessions.create(1)
    key = f"sess:{sessions._token_hash(token)}"
    import time as _time

    await fake_redis.hset(key, "created_at", str(int(_time.time()) - 9999))
    assert await sessions.validate(token) is None
    assert await fake_redis.hgetall(key) == {}


async def test_session_set_ttl_is_only_extended_never_shortened(fake_redis):
    # A long remember-me login sets a long SET TTL; a later short normal login
    # for the same user must not curtail it (design D5 "longest absolute cap"),
    # or destroy_all would later miss the still-valid long-lived session.
    set_key = "user_sessions:5"
    await sessions.create(5, remember=True)
    long_ttl = await fake_redis.ttl(set_key)
    assert long_ttl > settings.session_absolute_ttl

    await sessions.create(5, remember=False)
    assert await fake_redis.ttl(set_key) >= long_ttl - 5


async def test_destroy_all_rejects_a_sibling_session(fake_redis):
    a = await sessions.create(5)
    b = await sessions.create(5)
    await sessions.destroy_all(5, except_token=a)
    assert await sessions.validate(a) is not None
    assert await sessions.validate(b) is None


async def test_single_destroy_rejects_the_same_cookie_afterwards(fake_redis):
    token = await sessions.create(9)
    await sessions.destroy(token)
    assert await sessions.validate(token) is None
