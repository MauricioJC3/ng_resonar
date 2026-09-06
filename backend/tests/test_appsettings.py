"""Per-user settings service (design D3, per-user-settings req).

The typed ``user_settings`` columns are authoritative for the credential fields;
``data`` (JSONB) only carries the keys without a dedicated column
(``lastfm.apiKey`` / ``lastfm.apiSecret`` / ``listenbrainz.enabled``). These
tests pin that the columns actually hold the values and are read back.
"""

from app import security
from app.models import User, UserSettings
from app.models.user import ROLE_USER
from app.services import appsettings


def _mk_user(db_session, username: str) -> User:
    user = User(
        username=username,
        password_hash=security.hash_password("settings-user-pass-1"),
        role=ROLE_USER,
    )
    db_session.add(user)
    db_session.flush()
    return user


def test_update_persists_the_typed_columns(db_session):
    user = _mk_user(db_session, "alice")

    appsettings.update(
        db_session,
        user.id,
        {
            "lastfm": {
                "enabled": True,
                "apiKey": "kkk",
                "apiSecret": "sss",
                "sessionKey": "sk-123",
                "username": "alice-fm",
            },
            "listenbrainz": {"enabled": True, "token": "lb-tok-9"},
        },
    )

    row = db_session.get(UserSettings, user.id)
    assert row.lastfm_session_key == "sk-123"
    assert row.lastfm_username == "alice-fm"
    assert row.listenbrainz_token == "lb-tok-9"
    assert row.scrobble_enabled is True
    # The blob only keeps the columnless keys.
    assert row.data == {
        "lastfm": {"apiKey": "kkk", "apiSecret": "sss"},
        "listenbrainz": {"enabled": True},
    }


def test_load_reads_from_the_typed_columns_not_a_stale_blob(db_session):
    user = _mk_user(db_session, "bob")
    db_session.add(
        UserSettings(
            user_id=user.id,
            lastfm_session_key="col-sk",
            lastfm_username="col-user",
            listenbrainz_token="col-tok",
            scrobble_enabled=True,
            data={"lastfm": {"apiKey": "col-key", "apiSecret": "col-sec"}},
        )
    )
    db_session.flush()

    cfg = appsettings.load(db_session, user.id)
    assert cfg["lastfm"]["sessionKey"] == "col-sk"
    assert cfg["lastfm"]["username"] == "col-user"
    assert cfg["lastfm"]["enabled"] is True
    assert cfg["lastfm"]["apiKey"] == "col-key"
    assert cfg["listenbrainz"]["token"] == "col-tok"


def test_set_lastfm_session_writes_the_columns(db_session):
    user = _mk_user(db_session, "carol")

    appsettings.set_lastfm_session(db_session, user.id, "new-sk", "carol-fm")

    row = db_session.get(UserSettings, user.id)
    assert row.lastfm_session_key == "new-sk"
    assert row.lastfm_username == "carol-fm"
    assert row.scrobble_enabled is True


def test_blank_secret_patch_does_not_wipe_stored_credentials(db_session):
    user = _mk_user(db_session, "dave")
    appsettings.update(
        db_session,
        user.id,
        {"lastfm": {"sessionKey": "keep-me", "apiKey": "keep-key"}},
    )

    appsettings.update(
        db_session, user.id, {"lastfm": {"sessionKey": "", "apiKey": ""}}
    )

    row = db_session.get(UserSettings, user.id)
    assert row.lastfm_session_key == "keep-me"
    assert row.data["lastfm"]["apiKey"] == "keep-key"


def test_settings_rows_are_isolated_per_user(db_session):
    alice = _mk_user(db_session, "alice2")
    bob = _mk_user(db_session, "bob2")
    appsettings.update(
        db_session, alice.id, {"lastfm": {"sessionKey": "alice-only"}}
    )

    assert appsettings.load(db_session, bob.id)["lastfm"]["sessionKey"] == ""
    assert db_session.get(UserSettings, bob.id).lastfm_session_key is None
