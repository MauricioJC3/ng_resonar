"""Superadmin user administration (thin router; logic in ``services/users.py``).

Mounted in ``main.py`` under ``dependencies=[Depends(require_superadmin)]`` so
every route here is superadmin-only. Self-service password change lives on the
auth router (``PATCH /api/auth/password``, the single fixed ``_PW_EXEMPT``
path); ``PATCH /api/users/{id}/password`` below is the superadmin
"set another user's password" action.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import security, sessions
from ..db import get_db
from ..services import users as users_service

router = APIRouter(tags=["users"])


class CreateUserBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=1024)


class AdminPasswordBody(BaseModel):
    newPassword: str = Field(min_length=1, max_length=1024)


@router.get("/users")
async def list_users(db: Session = Depends(get_db)):
    results = await run_in_threadpool(users_service.list_users, db)
    return {"results": results}


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(body: CreateUserBody, db: Session = Depends(get_db)):
    try:
        return await run_in_threadpool(
            users_service.create_user,
            db,
            username=body.username,
            password=body.password,
        )
    except security.PasswordPolicyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    except users_service.UsernameTaken:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken",
        )


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    try:
        await run_in_threadpool(users_service.delete_user, db, user_id)
    except users_service.UserNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    except users_service.LastSuperadmin:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete the last superadmin",
        )
    await sessions.destroy_all(user_id)
    return {"ok": True}


@router.patch("/users/{user_id}/password")
async def set_user_password(
    user_id: int, body: AdminPasswordBody, db: Session = Depends(get_db)
):
    try:
        await run_in_threadpool(
            users_service.admin_set_password, db, user_id, body.newPassword
        )
    except users_service.UserNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    except security.PasswordPolicyError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    await sessions.destroy_all(user_id)
    return {"ok": True}
