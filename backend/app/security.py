"""Password hashing (Argon2id) and password-policy enforcement.

Argon2id parameters (design D10): time_cost=3, memory_cost=65536 KiB (64 MiB),
parallelism=2. Login volume on a personal server is a handful per day, so a
~50-100 ms hash is free and sits comfortably above the OWASP minimum.
"""

from __future__ import annotations

import os
from functools import lru_cache

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

TIME_COST = 3
MEMORY_COST = 65_536
PARALLELISM = 2

MIN_PASSWORD_LENGTH = 12

_hasher = PasswordHasher(
    time_cost=TIME_COST,
    memory_cost=MEMORY_COST,
    parallelism=PARALLELISM,
)

# A real Argon2id hash with the exact params above. Computed once per process so
# an unknown-user / locked-account login can run a verify with identical timing
# to a genuine one (design D9 timing equalization).
_DUMMY_HASH = _hasher.hash("resonar-timing-equalization-placeholder")

_BLOCKLIST_PATH = os.path.join(
    os.path.dirname(__file__), "assets", "common_passwords.txt"
)


class PasswordPolicyError(ValueError):
    """Raised when a candidate password fails the policy."""


@lru_cache(maxsize=1)
def _blocklist() -> frozenset[str]:
    out: set[str] = set()
    try:
        with open(_BLOCKLIST_PATH, encoding="utf-8") as fh:
            for line in fh:
                item = line.strip()
                if item and not item.startswith("#"):
                    out.add(item.lower())
    except OSError:  # pragma: no cover - asset is bundled
        pass
    return frozenset(out)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(stored_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def dummy_verify() -> None:
    """Run a verify against the fixed dummy hash to equalize response timing."""
    try:
        _hasher.verify(_DUMMY_HASH, "not-the-password")
    except (VerifyMismatchError, InvalidHashError):
        pass


def needs_rehash(stored_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except InvalidHashError:  # pragma: no cover
        return True


def validate_password(password: str) -> None:
    """Raise ``PasswordPolicyError`` if the password is too short or blocklisted."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise PasswordPolicyError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        )
    if password.strip().lower() in _blocklist():
        raise PasswordPolicyError("Password is too common; choose another.")
