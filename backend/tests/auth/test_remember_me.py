"""Remember-me cookie + session TTLs (design D5; session-lifecycle spec:
"Remember me" MUST use a longer idle TTL, a longer absolute cap and a
persistent cookie; unchecked MUST be a session cookie with the short idle TTL).

Two angles:
  * HTTP: ``POST /api/auth/login`` Set-Cookie carries ``Max-Age`` only when
    ``remember=true``.
  * Redis: ``sessions.create`` writes the remember TTLs on ``sess:<h>`` and the
    remember absolute cap on ``user_sessions:<uid>``.
"""

import pytest

from app import security, sessions
from app.config import settings
from app.db import SessionLocal
from app.models import User
from app.models.user import ROLE_USER

PASSWORD = "remember-me-pass-1"


@pytest.fixture
def seed_user(pg_engine):
    with SessionLocal() as db:
        user = User(
            username="rem",
            password_hash=security.hash_password(PASSWORD),
            role=ROLE_USER,
            must_change_password=False,
        )
        db.add(user)
        db.commit()
        return user.id


# --- HTTP cookie shape -----------------------------------------------------


def test_remember_true_sets_a_persistent_cookie(api, seed_user, db_reset):
    res = api.post(
        "/api/auth/login",
        json={"username": "rem", "password": PASSWORD, "remember": True},
    )
    assert res.status_code == 200
    set_cookie = res.headers["set-cookie"].lower()
    assert "max-age=" in set_cookie or "expires=" in set_cookie
    # Max-Age is the remember absolute cap.
    assert f"max-age={settings.session_remember_absolute_ttl}" in set_cookie


def test_remember_false_sets_a_session_cookie(api, seed_user, db_reset):
    res = api.post(
        "/api/auth/login",
        json={"username": "rem", "password": PASSWORD, "remember": False},
    )
    assert res.status_code == 200
    set_cookie = res.headers["set-cookie"].lower()
    assert "max-age=" not in set_cookie
    assert "expires=" not in set_cookie


# --- Redis TTLs ----------------------------------------------------------


async def test_remember_session_uses_the_long_redis_ttls(fake_redis):
    token = await sessions.create(101, remember=True)
    h = sessions._token_hash(token)

    sess_ttl = await fake_redis.ttl(f"sess:{h}")
    set_ttl = await fake_redis.ttl(f"user_sessions:101")

    assert (
        settings.session_remember_idle_ttl - 5
        <= sess_ttl
        <= settings.session_remember_idle_ttl
    )
    assert (
        settings.session_remember_absolute_ttl - 5
        <= set_ttl
        <= settings.session_remember_absolute_ttl
    )
    # Distinctly longer than a normal session.
    assert sess_ttl > settings.session_idle_ttl


async def test_normal_session_uses_the_short_redis_ttls(fake_redis):
    token = await sessions.create(102, remember=False)
    h = sessions._token_hash(token)

    sess_ttl = await fake_redis.ttl(f"sess:{h}")
    set_ttl = await fake_redis.ttl(f"user_sessions:102")

    assert (
        settings.session_idle_ttl - 5 <= sess_ttl <= settings.session_idle_ttl
    )
    assert (
        settings.session_absolute_ttl - 5
        <= set_ttl
        <= settings.session_absolute_ttl
    )
    assert sess_ttl < settings.session_remember_idle_ttl
