"""Superadmin user administration — ``/api/users`` (design D6; user-management
spec: superadmin-only admin, forced first-login change, self-service change).

These drive the REAL ``current_user`` via cookie sessions on fakeredis, so both
the ``must_change_password`` 403 gate and the ``require_superadmin`` 403 are
exercised end to end rather than stubbed.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app import security
from app.config import settings
from app.db import SessionLocal
from app.main import app
from app.models import User

SUPER_PW = "root-admin-pass-1"
ALICE_PW = "alice-temp-pass-1234"
NEW_PW = "alice-brand-new-pass-1"


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    # Keep bootstrap's JSON migration away from any real ./data mount.
    monkeypatch.setattr(settings, "data_dir", str(tmp_path))
    return tmp_path


@pytest.fixture
def superadmin(api, data_dir, monkeypatch, db_reset):
    """The ``api`` TestClient carrying a freshly bootstrapped superadmin cookie."""
    monkeypatch.setattr(settings, "bootstrap_token", None)
    res = api.post(
        "/api/auth/bootstrap", json={"username": "root", "password": SUPER_PW}
    )
    assert res.status_code == 200
    return api


def _login(client: TestClient, username: str, password: str):
    return client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )


def _row(username: str) -> tuple[str, int]:
    """(password_hash, id) for a committed user."""
    with SessionLocal() as db:
        u = db.execute(
            select(User).where(func.lower(User.username) == username.lower())
        ).scalar_one()
        return u.password_hash, u.id


# --- superadmin-only access -------------------------------------------------


def test_superadmin_creates_and_lists_users(superadmin):
    created = superadmin.post(
        "/api/users", json={"username": "alice", "password": ALICE_PW}
    )
    assert created.status_code == 201
    body = created.json()
    assert body["username"] == "alice"
    assert body["role"] == "user"
    assert body["mustChangePassword"] is True
    assert body["createdAt"]

    listing = superadmin.get("/api/users").json()["results"]
    assert [u["username"] for u in listing] == ["root", "alice"]
    for u in listing:
        assert set(u) == {
            "id",
            "username",
            "role",
            "mustChangePassword",
            "createdAt",
        }


def test_non_superadmin_is_403_on_every_users_route(superadmin):
    alice_id = superadmin.post(
        "/api/users", json={"username": "alice", "password": ALICE_PW}
    ).json()["id"]

    alice = TestClient(app)
    assert _login(alice, "alice", ALICE_PW).status_code == 200
    # Clear the forced-change flag so we test require_superadmin, not the gate.
    assert (
        alice.patch(
            "/api/auth/password",
            json={"currentPassword": ALICE_PW, "newPassword": NEW_PW},
        ).status_code
        == 200
    )

    assert alice.get("/api/users").status_code == 403
    assert (
        alice.post(
            "/api/users",
            json={"username": "eve", "password": "eve-strong-pass-1"},
        ).status_code
        == 403
    )
    assert alice.delete(f"/api/users/{alice_id}").status_code == 403
    assert (
        alice.patch(
            f"/api/users/{alice_id}/password",
            json={"newPassword": "eve-strong-pass-1"},
        ).status_code
        == 403
    )
    assert alice.get("/api/users").json()["detail"] == "Superadmin only"


# --- forced first-login password change ------------------------------------


def test_created_user_is_blocked_until_password_changed(superadmin):
    superadmin.post(
        "/api/users", json={"username": "alice", "password": ALICE_PW}
    )

    alice = TestClient(app)
    assert _login(alice, "alice", ALICE_PW).status_code == 200

    for path in (
        "/api/playlists",
        "/api/favorites",
        "/api/history",
        "/api/settings",
    ):
        r = alice.get(path)
        assert r.status_code == 403, path
        assert r.json()["detail"] == {"code": "must_change_password"}

    # Her own password change on the auth router IS reachable while blocked.
    assert (
        alice.patch(
            "/api/auth/password",
            json={"currentPassword": ALICE_PW, "newPassword": NEW_PW},
        ).status_code
        == 200
    )

    # Flag cleared -> the rest of the API opens up on the same session.
    assert alice.get("/api/playlists").status_code == 200


# --- adminSetPassword: policy + force + logout-all ------------------------


def test_admin_set_password_forces_change_and_logs_out_target(superadmin):
    alice_id = superadmin.post(
        "/api/users", json={"username": "alice", "password": ALICE_PW}
    ).json()["id"]

    alice = TestClient(app)
    _login(alice, "alice", ALICE_PW)
    alice.patch(
        "/api/auth/password",
        json={"currentPassword": ALICE_PW, "newPassword": NEW_PW},
    )
    assert alice.get("/api/playlists").status_code == 200  # live session

    res = superadmin.patch(
        f"/api/users/{alice_id}/password",
        json={"newPassword": "admin-forced-pass-1"},
    )
    assert res.status_code == 200

    # destroy_all killed alice's session ...
    assert alice.get("/api/auth/me").json()["authenticated"] is False
    # ... and she must change the password again on her next login.
    assert _login(alice, "alice", "admin-forced-pass-1").status_code == 200
    assert alice.get("/api/playlists").json()["detail"] == {
        "code": "must_change_password"
    }


def test_admin_set_password_runs_the_policy(superadmin):
    alice_id = superadmin.post(
        "/api/users", json={"username": "alice", "password": ALICE_PW}
    ).json()["id"]
    assert (
        superadmin.patch(
            f"/api/users/{alice_id}/password", json={"newPassword": "short"}
        ).status_code
        == 422
    )


def test_admin_set_password_on_missing_user_is_404(superadmin):
    assert (
        superadmin.patch(
            "/api/users/999999/password",
            json={"newPassword": "whatever-strong-1"},
        ).status_code
        == 404
    )


# --- self-service change (auth router) safety net -------------------------


def test_self_password_change_wrong_current_is_403_and_unchanged(superadmin):
    superadmin.post(
        "/api/users", json={"username": "alice", "password": ALICE_PW}
    )
    alice = TestClient(app)
    _login(alice, "alice", ALICE_PW)

    res = alice.patch(
        "/api/auth/password",
        json={"currentPassword": "not-alices-password", "newPassword": NEW_PW},
    )
    assert res.status_code == 403

    hash_after, _ = _row("alice")
    assert security.verify_password(hash_after, ALICE_PW)
    assert not security.verify_password(hash_after, NEW_PW)


def test_non_superadmin_cannot_set_another_users_password(superadmin):
    superadmin.post(
        "/api/users", json={"username": "alice", "password": ALICE_PW}
    )
    bob_id = superadmin.post(
        "/api/users", json={"username": "bob", "password": "bob-temp-pass-1234"}
    ).json()["id"]

    alice = TestClient(app)
    _login(alice, "alice", ALICE_PW)
    alice.patch(
        "/api/auth/password",
        json={"currentPassword": ALICE_PW, "newPassword": NEW_PW},
    )

    r = alice.patch(
        f"/api/users/{bob_id}/password",
        json={"newPassword": "pwned-pass-123456"},
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "Superadmin only"


# --- deletion guards -----------------------------------------------------


def test_deleting_the_only_superadmin_is_409(superadmin):
    _, root_id = _row("root")
    res = superadmin.delete(f"/api/users/{root_id}")
    assert res.status_code == 409
    assert "superadmin" in res.json()["detail"].lower()
    assert _row("root")[1] == root_id  # still present


def test_delete_removes_the_user_and_a_missing_id_is_404(superadmin):
    alice_id = superadmin.post(
        "/api/users", json={"username": "alice", "password": ALICE_PW}
    ).json()["id"]

    assert superadmin.delete(f"/api/users/{alice_id}").json() == {"ok": True}
    assert [u["username"] for u in superadmin.get("/api/users").json()["results"]] == [
        "root"
    ]
    assert superadmin.delete(f"/api/users/{alice_id}").status_code == 404


def test_second_superadmin_can_be_deleted(superadmin):
    # Promote a second superadmin directly, then it may be removed.
    with SessionLocal() as db:
        db.add(
            User(
                username="root2",
                password_hash=security.hash_password("root2-admin-pass-1"),
                role="superadmin",
                must_change_password=False,
            )
        )
        db.commit()
    _, root2_id = _row("root2")
    assert superadmin.delete(f"/api/users/{root2_id}").status_code == 200


# --- duplicate username -------------------------------------------------


def test_duplicate_username_is_409_case_insensitive(superadmin):
    assert (
        superadmin.post(
            "/api/users", json={"username": "alice", "password": ALICE_PW}
        ).status_code
        == 201
    )
    assert (
        superadmin.post(
            "/api/users",
            json={"username": "ALICE", "password": "another-strong-pass-1"},
        ).status_code
        == 409
    )


def test_create_user_rejects_a_weak_password(superadmin):
    assert (
        superadmin.post(
            "/api/users", json={"username": "weak", "password": "short"}
        ).status_code
        == 422
    )
