"""Argon2id hashing + password policy (design D9 / D10, password-policy req)."""

import pytest
from argon2 import PasswordHasher

from app import security


def test_hash_then_verify_roundtrips():
    h = security.hash_password("correct horse battery staple")
    assert h != "correct horse battery staple"
    assert security.verify_password(h, "correct horse battery staple") is True


def test_verify_rejects_a_wrong_password():
    h = security.hash_password("the-right-one-12chars")
    assert security.verify_password(h, "the-wrong-one") is False


def test_verify_rejects_a_malformed_hash():
    assert security.verify_password("not-a-hash", "whatever") is False


def test_needs_rehash_is_true_for_weaker_params_and_false_for_current():
    weak = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
    old_hash = weak.hash("some-password-1234")
    assert security.needs_rehash(old_hash) is True
    assert security.needs_rehash(security.hash_password("some-password-1234")) is False


def test_dummy_verify_runs_without_raising():
    # Timing-equalization path for unknown users / locked accounts.
    security.dummy_verify()


def test_policy_rejects_a_short_password():
    with pytest.raises(security.PasswordPolicyError):
        security.validate_password("pass1234")  # 8 chars


def test_policy_rejects_a_blocklisted_14_char_password():
    assert len("iloveyou123456") == 14
    with pytest.raises(security.PasswordPolicyError):
        security.validate_password("iloveyou123456")


def test_policy_accepts_a_long_uncommon_password():
    security.validate_password("k7$mples-orchard-42")
