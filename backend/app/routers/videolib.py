from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from ..services import videolib
from ._shared import VideoId

router = APIRouter(tags=["videolib"])


@router.get("/library/videos")
async def list_videos():
    return {"results": videolib.list_saved()}


@router.post("/library/videos/{video_id}")
async def save_video(
    video_id: VideoId,
    quality: int = Query(1080, ge=144, le=2160),
    force: bool = Query(False),
):
    status = await videolib.start_save(video_id, quality, force=force)
    return {"id": video_id, "status": status}


@router.delete("/library/videos/{video_id}")
async def remove_video(video_id: VideoId):
    return {"removed": videolib.delete_saved(video_id)}


@router.get("/library/videos/{video_id}/file")
async def video_file(video_id: VideoId):
    path = videolib.file_path(video_id)
    if not path:
        raise HTTPException(status_code=404, detail="video not saved")
    return FileResponse(path, media_type="video/mp4")


@router.get("/library/videos/{video_id}/download")
async def video_download(video_id: VideoId):
    path = videolib.file_path(video_id)
    if not path:
        raise HTTPException(status_code=404, detail="video not saved")
    meta = videolib.meta_for(video_id) or {}
    filename = f"{meta.get('title') or video_id}.mp4"
    return FileResponse(path, media_type="video/mp4", filename=filename)
