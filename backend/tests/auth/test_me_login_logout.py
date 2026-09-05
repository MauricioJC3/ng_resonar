"""/api/auth me + login + logout (design D6; login / session / logout / SPA-gate reqs)."""

import pytest

from app import security
from app.config import settings
from app.db import SessionLocal
from app.models import User
from app.models.user import ROLE_USER

PASSWORD = "correct-horse-1234"


@pytest.fixture
def seed_user(pg_engine):
    with SessionLocal() as db:
        user = User(
            username="alice",
            password_hash=security.hash_password(PASSWORD),
            role=ROLE_USER,
            must_change_password=False,
        )
        db.add(user)
        db.commit()
        return user.id


def test_me_unauthenticated_reports_bootstrap_available_when_empty(api, db_reset):
    body = api.get("/api/auth/me").json()
    assert body == {"authenticated": False, "bootstrapAvailable": True}


def test_me_unauthenticated_reports_bootstrap_closed_when_users_exist(api, seed_user, db_reset):
    body = api.get("/api/auth/me").json()
    assert body == {"authenticated": False, "bootstrapAvailable": False}


def test_login_then_me_returns_the_identity(api, seed_user, db_reset):
    res = api.post(
        "/api/auth/login", json={"username": "alice", "password": PASSWORD}
    )
    assert res.status_code == 200
    assert res.json()["user"]["username"] == "alice"
    assert settings.session_cookie_name in res.cookies

    me = api.get("/api/auth/me").json()
    assert me["authenticated"] is True
    assert me["user"]["username"] == "alice"


def test_login_issues_an_opaque_token_backed_by_a_redis_record(api, seed_user, db_reset):
    res = api.post(
        "/api/auth/login", json={"username": "alice", "password": PASSWORD}
    )
    token = res.cookies.get(settings.session_cookie_name)
    assert token and len(token) >= 32  # opaque token_urlsafe(32), not a JWT/identity
    # The record is keyed by the token hash: /api/auth/me only authenticates if
    # HGETALL sess:<sha256(token)> succeeds.
    assert api.get("/api/auth/me").json()["authenticated"] is True


def test_wrong_password_is_401_generic(api, seed_user, db_reset):
    res = api.post(
        "/api/auth/login", json={"username": "alice", "password": "nope-nope-nope"}
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid username or password"
    assert settings.session_cookie_name not in res.cookies


def test_unknown_username_is_401_with_the_same_message(api, db_reset):
    res = api.post(
        "/api/auth/login",
        json={"username": "ghost", "password": "whatever-1234567"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid username or password"


def test_cookie_has_no_secure_attribute_when_disabled(api, seed_user, db_reset, monkeypatch):
    monkeypatch.setattr(settings, "session_cookie_secure", False)
    res = api.post(
        "/api/auth/login", json={"username": "alice", "password": PASSWORD}
    )
    set_cookie = res.headers["set-cookie"].lower()
    assert "secure" not in set_cookie


def test_cookie_has_secure_attribute_when_enabled(api, seed_user, db_reset, monkeypatch):
    monkeypatch.setattr(settings, "session_cookie_secure", True)
    res = api.post(
        "/api/auth/login", json={"username": "alice", "password": PASSWORD}
    )
    assert "secure" in res.headers["set-cookie"].lower()


def test_logout_rejects_the_same_cookie_afterwards(api, seed_user, db_reset):
    api.post("/api/auth/login", json={"username": "alice", "password": PASSWORD})
    assert api.get("/api/auth/me").json()["authenticated"] is True

    out = api.post("/api/auth/logout")
    assert out.status_code == 200

    after = api.get("/api/auth/me").json()
    assert after["authenticated"] is False
