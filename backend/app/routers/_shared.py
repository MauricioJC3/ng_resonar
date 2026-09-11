"""Shared param annotations reused across the video-related routers."""

from __future__ import annotations

from typing import Annotated

from fastapi import Path

# A YouTube video ID is always exactly 11 characters from the URL-safe
# base64 alphabet. Confirmed against this codebase's own usage: the URL
# extraction regex in services/importer.py (`[\w-]{11}`) and the
# fixed-length suffix check in services/ytmusic.py's radio-playlist-id
# parsing both assume this shape.
VideoId = Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{11}$")]
