"""Login / password domain logic (design D6). Routers stay thin."""

from __future__ import annotations

from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from .. import security
from ..models import User
from ..repos import users as users_repo


def user_identity(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "mustChangePassword": user.must_change_password,
    }


async def authenticate(
    db: Session, username: str, password: str
) -> User | None:
    """Return the user on correct credentials, else ``None``.

    Always performs one Argon2 verification (a dummy one for unknown users) so
    the response time does not disclose account existence.
    """
    user = await run_in_threadpool(
        users_repo.get_by_username_lower, db, username
    )
    if user is None:
        security.dummy_verify()
        return None
    if not security.verify_password(user.password_hash, password):
        return None
    if security.needs_rehash(user.password_hash):
        await run_in_threadpool(
            users_repo.set_password,
            db,
            user,
            security.hash_password(password),
        )
    return user
