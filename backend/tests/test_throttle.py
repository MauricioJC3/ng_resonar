"""Brute-force login throttle (design D9; brute-force-throttle req).
Uses fakeredis, no Postgres."""

import asyncio

import pytest
from fastapi import HTTPException

from app import throttle


@pytest.fixture(autouse=True)
def _no_jitter(monkeypatch):
    monkeypatch.setattr(throttle.random, "uniform", lambda a, b: 0)


class _Req:
    def __init__(self, headers):
        self.headers = headers


def test_client_ip_prefers_cf_then_xff_then_unknown():
    assert throttle.client_ip(_Req({"CF-Connecting-IP": "9.9.9.9"})) == "9.9.9.9"
    assert (
        throttle.client_ip(_Req({"X-Forwarded-For": "3.3.3.3, 4.4.4.4"}))
        == "3.3.3.3"
    )
    assert throttle.client_ip(_Req({})) == "unknown"


async def test_username_threshold_locks_then_reopens_after_window(fake_redis):
    for _ in range(throttle.MAX_FAILURES_PER_USERNAME):
        await throttle.record_failure("alice", "10.0.0.1")
    with pytest.raises(HTTPException) as exc:
        await throttle.enforce("alice", "10.0.0.9")
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers

    # simulate the rolling window elapsing
    await fake_redis.pexpire(throttle._user_key("alice"), 10)
    await asyncio.sleep(0.05)
    await throttle.enforce("alice", "10.0.0.9")  # no raise


async def test_ip_threshold_locks(fake_redis):
    for _ in range(throttle.MAX_FAILURES_PER_IP):
        await throttle.record_failure(f"u{_}", "20.0.0.1")
    with pytest.raises(HTTPException) as exc:
        await throttle.enforce("someone-else", "20.0.0.1")
    assert exc.value.status_code == 429


async def test_success_clears_both_counters(fake_redis):
    await throttle.record_failure("bob", "30.0.0.1")
    await throttle.record_failure("bob", "30.0.0.1")
    await throttle.record_success("bob", "30.0.0.1")
    assert await fake_redis.get(throttle._user_key("bob")) is None
    assert await fake_redis.get(throttle._ip_key("30.0.0.1")) is None
    # counters gone -> enforce passes
    await throttle.enforce("bob", "30.0.0.1")


async def test_below_threshold_does_not_lock(fake_redis):
    for _ in range(throttle.MAX_FAILURES_PER_USERNAME - 1):
        await throttle.record_failure("carol", "40.0.0.1")
    await throttle.enforce("carol", "40.0.0.1")  # no raise
