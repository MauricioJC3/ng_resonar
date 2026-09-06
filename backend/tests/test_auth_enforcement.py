"""Threat-matrix RED test (design §7, HTTP route auth gating).

Every mounted ``/api/*`` route is hit with NO session cookie. All of them must
answer 401 (or 403 for ``must_change_password``) except a fixed four-entry
allowlist, which must answer their normal status. An unlisted-but-public route
is an auth bypass and fails this test.
"""

import re

import pytest
from fastapi.routing import APIRoute

from app.main import app

# The only routes reachable with no valid session.
ALLOWLIST = {
    ("GET", "/api/health"),
    ("POST", "/api/auth/login"),
    ("GET", "/api/auth/me"),
    ("POST", "/api/auth/bootstrap"),
}


def _api_routes() -> list[tuple[str, str]]:
    found: set[tuple[str, str]] = set()
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api"):
            continue
        for method in route.methods:
            if method in ("HEAD", "OPTIONS"):
                continue
            found.add((method, route.path))
    return sorted(found)


def test_the_route_table_is_not_empty():
    # Guards against a refactor that stops registering routers entirely.
    assert len(_api_routes()) > 15


@pytest.mark.parametrize("method,path", _api_routes())
def test_route_requires_a_session_unless_allowlisted(api, db_reset, method, path):
    url = re.sub(r"\{[^}]+\}", "x", path)
    resp = api.request(method, url)
    if (method, path) in ALLOWLIST:
        assert resp.status_code not in (401, 403), (
            f"{method} {path} is allowlisted but was gated ({resp.status_code})"
        )
    else:
        assert resp.status_code in (401, 403), (
            f"{method} {path} answered {resp.status_code} with no cookie — "
            "auth bypass"
        )


def test_health_is_200_with_no_cookie(api):
    assert api.get("/api/health").status_code == 200


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_interactive_docs_and_schema_are_disabled(api, path):
    # They live outside /api and would otherwise expose the full route map
    # without a session.
    assert api.get(path).status_code == 404


def test_logout_and_password_change_are_gated(api, db_reset):
    assert api.post("/api/auth/logout").status_code == 401
    assert api.patch(
        "/api/auth/password",
        json={"currentPassword": "x", "newPassword": "y" * 12},
    ).status_code == 401
