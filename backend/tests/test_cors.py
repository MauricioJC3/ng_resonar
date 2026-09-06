"""Credentialed CORS (spec: Credentialed CORS; carried SUGGESTION S5).

Cookie auth is incompatible with a wildcard ``Access-Control-Allow-Origin``. The
app MUST send ``Access-Control-Allow-Credentials: true`` and MUST echo the exact
allowed origin, never ``*``.
"""

from app.main import app

ALLOWED_ORIGIN = "https://resonar.example.org"


def _cors_middleware():
    for mw in app.user_middleware:
        if mw.cls.__name__ == "CORSMiddleware":
            return mw
    raise AssertionError("CORSMiddleware is not installed on the app")


def test_installed_cors_is_credentialed_and_never_wildcard():
    kwargs = _cors_middleware().kwargs
    assert kwargs.get("allow_credentials") is True
    assert "*" not in (kwargs.get("allow_origins") or [])


def test_api_response_is_credentialed_and_echoes_the_allowed_origin(api, monkeypatch):
    mw = _cors_middleware()
    # The middleware freezes ``allow_origins`` at import; inject a configured
    # allowed origin and rebuild the stack for this test only.
    monkeypatch.setattr(
        mw, "kwargs", {**mw.kwargs, "allow_origins": [ALLOWED_ORIGIN]}
    )
    monkeypatch.setattr(app, "middleware_stack", app.build_middleware_stack())

    resp = api.get("/api/health", headers={"Origin": ALLOWED_ORIGIN})

    assert resp.status_code == 200
    acao = resp.headers.get("access-control-allow-origin")
    assert acao == ALLOWED_ORIGIN
    assert acao != "*"
    assert resp.headers.get("access-control-allow-credentials") == "true"
