"""Auth endpoints: login / logout / me / bootstrap / password (design D6, D8).

Thin router — domain logic lives in ``services/auth.py`` and
``services/bootstrap.py``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import security, sessions, throttle
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import User
from ..repos import users as users_repo
from ..services import auth as auth_service
from ..services import bootstrap as bootstrap_service

router = APIRouter(tags=["auth"])


class LoginBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=1024)
    remember: bool = False


class BootstrapBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=1024)
    bootstrapToken: str | None = None


class PasswordChangeBody(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=1024)
    newPassword: str = Field(min_length=1, max_length=1024)


def _set_session_cookie(response: Response, token: str, remember: bool) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
        max_age=sessions.cookie_max_age(remember),
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


@router.post("/auth/login")
async def login(
    body: LoginBody,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    ip = throttle.client_ip(request)
    await throttle.enforce(body.username, ip)

    user = await auth_service.authenticate(db, body.username, body.password)
    if user is None:
        await throttle.record_failure(body.username, ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    await throttle.record_success(body.username, ip)
    token = await sessions.create(
        user.id,
        remember=body.remember,
        ip=ip,
        ua=request.headers.get("user-agent"),
    )
    _set_session_cookie(response, token, body.remember)
    return {"authenticated": True, "user": auth_service.user_identity(user)}


@router.post("/auth/logout")
async def logout(
    request: Request,
    response: Response,
    user: User = Depends(current_user),
):
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        await sessions.destroy(token)
    _clear_session_cookie(response)
    return {"ok": True}


@router.get("/auth/me")
async def me(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        sess = await sessions.validate(token)
        if sess:
            user = await run_in_threadpool(
                users_repo.get, db, int(sess["user_id"])
            )
            if user is not None:
                return {
                    "authenticated": True,
                    "user": auth_service.user_identity(user),
                }
    total = await run_in_threadpool(users_repo.count, db)
    return {"authenticated": False, "bootstrapAvailable": total == 0}


@router.patch("/auth/password")
async def change_password(
    body: PasswordChangeBody,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not security.verify_password(user.password_hash, body.currentPassword):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Current password is incorrect",
        )
    try:
        security.validate_password(body.newPassword)
    except security.PasswordPolicyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )

    await run_in_threadpool(
        users_repo.set_password, db, user, security.hash_password(body.newPassword)
    )
    await run_in_threadpool(users_repo.clear_must_change, db, user)

    token = request.cookies.get(settings.session_cookie_name)
    await sessions.destroy_all(user.id, except_token=token)
    return {"ok": True}


@router.post("/auth/bootstrap")
async def bootstrap(
    body: BootstrapBody,
    request: Request,
    response: Response,
):
    if settings.bootstrap_token and body.bootstrapToken != settings.bootstrap_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid bootstrap token",
        )
    try:
        security.validate_password(body.password)
    except security.PasswordPolicyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )

    password_hash = security.hash_password(body.password)
    try:
        user_id = await run_in_threadpool(
            bootstrap_service.run_bootstrap, body.username, password_hash
        )
    except bootstrap_service.BootstrapClosed:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Bootstrap is permanently closed",
        )

    ip = throttle.client_ip(request)
    token = await sessions.create(
        user_id, remember=False, ip=ip, ua=request.headers.get("user-agent")
    )
    _set_session_cookie(response, token, False)
    return {
        "authenticated": True,
        "user": {
            "id": user_id,
            "username": body.username.strip(),
            "role": "superadmin",
            "mustChangePassword": False,
        },
    }
