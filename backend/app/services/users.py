"""Superadmin user-administration logic (design D6). Router stays thin.

Password self-service stays on ``PATCH /api/auth/password`` (the single fixed
``_PW_EXEMPT`` path). ``PATCH /api/users/{id}/password`` is the superadmin-only
"set another user's password" action: it takes no current password, re-runs the
password policy, forces ``must_change_password`` back on, and the caller then
destroys the target's sessions.
"""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import security
from ..models import User
from ..models.user import ROLE_SUPERADMIN, ROLE_USER
from ..repos import users as users_repo


class UsernameTaken(Exception):
    """A user with that (case-insensitive) username already exists."""


class UserNotFound(Exception):
    """No user with that id."""


class LastSuperadmin(Exception):
    """Refused: a Resonar instance must always keep at least one superadmin."""


def user_summary(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "mustChangePassword": user.must_change_password,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }


def list_users(db: Session) -> list[dict]:
    return [user_summary(u) for u in users_repo.list_all(db)]


def create_user(db: Session, *, username: str, password: str) -> dict:
    """Create a ``role='user'`` row that must change its password on first login.

    Raises ``security.PasswordPolicyError`` on a weak password and
    ``UsernameTaken`` on a case-insensitive duplicate.
    """
    security.validate_password(password)
    if users_repo.get_by_username_lower(db, username) is not None:
        raise UsernameTaken(username)
    try:
        user = users_repo.create(
            db,
            username=username,
            password_hash=security.hash_password(password),
            role=ROLE_USER,
            must_change_password=True,
        )
    except IntegrityError as exc:  # ux_users_username_lower race
        db.rollback()
        raise UsernameTaken(username) from exc
    return user_summary(user)


def delete_user(db: Session, user_id: int) -> None:
    """Delete a user (rows cascade). Refuses to remove the last superadmin."""
    user = users_repo.get(db, user_id)
    if user is None:
        raise UserNotFound(user_id)
    if (
        user.role == ROLE_SUPERADMIN
        and users_repo.count_by_role(db, ROLE_SUPERADMIN) <= 1
    ):
        raise LastSuperadmin()
    users_repo.delete(db, user_id)


def admin_set_password(db: Session, user_id: int, new_password: str) -> None:
    """Superadmin sets another user's password; forces a change on next login."""
    user = users_repo.get(db, user_id)
    if user is None:
        raise UserNotFound(user_id)
    security.validate_password(new_password)
    users_repo.set_password(db, user, security.hash_password(new_password))
    users_repo.set_must_change(db, user, True)
