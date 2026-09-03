"""Shared byte-proxy for upstream media (audio + video).

Forwards Range requests unchanged (so seeking works), re-resolves once if the
cached googlevideo URL 403/410s before its advertised expiry, and streams the
bytes straight through.
"""

from __future__ import annotations

from typing import Awaitable, Callable

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

Resolver = Callable[..., Awaitable[dict]]


async def proxy_media(
    client: httpx.AsyncClient,
    request: Request,
    resolve: Resolver,
) -> StreamingResponse:
    data = await resolve()

    fwd_headers = {}
    range_header = request.headers.get("range")
    if range_header:
        fwd_headers["Range"] = range_header

    async def _open(url: str) -> httpx.Response:
        req = client.build_request("GET", url, headers=fwd_headers)
        return await client.send(req, stream=True)

    upstream = await _open(data["url"])
    if upstream.status_code in (403, 410):
        await upstream.aclose()
        data = await resolve(force=True)
        upstream = await _open(data["url"])

    if upstream.status_code >= 400:
        status = upstream.status_code
        await upstream.aclose()
        raise HTTPException(status_code=502, detail=f"upstream returned {status}")

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": data["mime"],
        "Cache-Control": "no-store",
    }
    for header in ("Content-Length", "Content-Range"):
        if header in upstream.headers:
            headers[header] = upstream.headers[header]

    return StreamingResponse(
        upstream.aiter_raw(),
        status_code=upstream.status_code,
        headers=headers,
        background=BackgroundTask(upstream.aclose),
    )
