from fastapi import APIRouter

from ..deps import get_cache, get_http

router = APIRouter(tags=["sponsorblock"])

# Segments worth auto-skipping in a "music video / clip" context.
_CATEGORIES = [
    "sponsor",
    "selfpromo",
    "interaction",
    "intro",
    "outro",
    "preview",
    "music_offtopic",
]


@router.get("/sponsorblock/{video_id}")
async def sponsorblock(video_id: str):
    cache = get_cache()
    key = f"sb:{video_id}"
    hit = await cache.get(key)
    if hit is not None:
        return {"segments": hit}

    client = get_http()
    params = [("videoID", video_id)] + [("category", c) for c in _CATEGORIES]
    segments: list[dict] = []
    try:
        res = await client.get(
            "https://sponsor.ajay.app/api/skipSegments", params=params
        )
        if res.status_code == 200:
            segments = [
                {
                    "start": float(s["segment"][0]),
                    "end": float(s["segment"][1]),
                    "category": s.get("category", "sponsor"),
                }
                for s in res.json()
                if isinstance(s.get("segment"), list) and len(s["segment"]) == 2
            ]
        # 404 = no segments for this video; anything else we just treat as empty
    except Exception:  # noqa: BLE001 - SponsorBlock being down must not break playback
        segments = []

    segments.sort(key=lambda s: s["start"])
    await cache.set(key, segments, 3600)
    return {"segments": segments}
