from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Playlist(Base):
    __tablename__ = "playlists"

    # Keep the existing "pl_<hex>" identifiers.
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (Index("ix_playlists_user_id", "user_id"),)


class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    playlist_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("playlists.id", ondelete="CASCADE"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    # YouTube video id, used for dedupe.
    track_id: Mapped[str] = mapped_column(Text, nullable=False)
    # Full Track shape preserved verbatim.
    track: Mapped[dict] = mapped_column(JSONB, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "playlist_id", "track_id", name="uq_playlist_tracks_playlist_track"
        ),
        Index("ix_pltracks_playlist_pos", "playlist_id", "position"),
    )
