"""User data access (design D3 / D6)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import User
from ..models.user import ROLE_USER


def get(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_by_username_lower(db: Session, username: str) -> User | None:
    stmt = select(User).where(
        func.lower(User.username) == username.strip().lower()
    )
    return db.execute(stmt).scalar_one_or_none()


def count(db: Session) -> int:
    return db.execute(select(func.count()).select_from(User)).scalar_one()


def create(
    db: Session,
    *,
    username: str,
    password_hash: str,
    role: str = ROLE_USER,
    must_change_password: bool = False,
) -> User:
    user = User(
        username=username.strip(),
        password_hash=password_hash,
        role=role,
        must_change_password=must_change_password,
    )
    db.add(user)
    db.flush()
    return user


def set_password(db: Session, user: User, password_hash: str) -> None:
    user.password_hash = password_hash
    db.flush()


def clear_must_change(db: Session, user: User) -> None:
    user.must_change_password = False
    db.flush()
