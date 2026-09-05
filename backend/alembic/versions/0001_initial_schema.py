"""initial schema: users, playlists, playlist_tracks, favorites, history, user_settings

Revision ID: 0001
Revises:
Create Date: 2026-09-05

Emits the exact DDL from design D3 (Postgres 16): VARCHAR + CHECK enums,
TIMESTAMPTZ DEFAULT now(), JSONB payloads, ON DELETE CASCADE on every
user-owned table, a functional unique index on lower(username), and the
per-table lookup indexes.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "role",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'user'"),
        ),
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "role IN ('superadmin','user')", name="ck_users_role"
        ),
    )
    op.create_index(
        "ux_users_username_lower",
        "users",
        [sa.text("lower(username)")],
        unique=True,
    )

    op.create_table(
        "playlists",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_playlists_user_id", "playlists", ["user_id"])

    op.create_table(
        "playlist_tracks",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "playlist_id",
            sa.Text(),
            sa.ForeignKey("playlists.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("track_id", sa.Text(), nullable=False),
        sa.Column("track", postgresql.JSONB(), nullable=False),
        sa.UniqueConstraint(
            "playlist_id", "track_id", name="uq_playlist_tracks_playlist_track"
        ),
    )
    op.create_index(
        "ix_pltracks_playlist_pos",
        "playlist_tracks",
        ["playlist_id", "position"],
    )

    op.create_table(
        "favorites",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("track_id", sa.Text(), nullable=False),
        sa.Column("track", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "user_id", "track_id", name="uq_favorites_user_track"
        ),
    )
    op.create_index(
        "ix_favorites_user_created",
        "favorites",
        ["user_id", sa.text("created_at DESC")],
    )

    op.create_table(
        "history",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("video_id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("artist", sa.Text()),
        sa.Column("thumbnail", sa.Text()),
        sa.Column(
            "kind",
            sa.String(length=8),
            nullable=False,
            server_default=sa.text("'song'"),
        ),
        sa.Column("source", sa.String(length=32)),
        sa.Column(
            "play_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column(
            "played_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_history_user_played",
        "history",
        ["user_id", sa.text("played_at DESC")],
    )

    op.create_table(
        "user_settings",
        sa.Column(
            "user_id",
            sa.BigInteger(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("lastfm_session_key", sa.Text()),
        sa.Column("lastfm_username", sa.Text()),
        sa.Column("listenbrainz_token", sa.Text()),
        sa.Column(
            "scrobble_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "data",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("user_settings")
    op.drop_index("ix_history_user_played", table_name="history")
    op.drop_table("history")
    op.drop_index("ix_favorites_user_created", table_name="favorites")
    op.drop_table("favorites")
    op.drop_index("ix_pltracks_playlist_pos", table_name="playlist_tracks")
    op.drop_table("playlist_tracks")
    op.drop_index("ix_playlists_user_id", table_name="playlists")
    op.drop_table("playlists")
    op.drop_index("ux_users_username_lower", table_name="users")
    op.drop_table("users")
