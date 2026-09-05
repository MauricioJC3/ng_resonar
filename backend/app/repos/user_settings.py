"""Per-user settings row access (design D3).

Replaces the single-file ``data/settings.json`` store. One row per user, created
lazily on first read. ``data/settings.json`` is deliberately NOT migrated.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import UserSettings


def get_or_create(db: Session, user_id: int) -> UserSettings:
    row = db.get(UserSettings, user_id)
    if row is None:
        row = UserSettings(user_id=user_id, data={})
        db.add(row)
        db.flush()
    return row
