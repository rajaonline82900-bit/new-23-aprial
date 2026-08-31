"""Help videos — admin-managed video URLs for deposit / withdraw guides."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import db
from auth import get_admin_user

router = APIRouter()

ALLOWED_KINDS = {'deposit', 'withdraw'}


class VideoUrl(BaseModel):
    url: str


@router.get('/help-videos/{kind}')
async def get_video(kind: str):
    if kind not in ALLOWED_KINDS:
        raise HTTPException(400, 'invalid kind')
    doc = await db.help_videos.find_one({'_id': kind})
    if not doc:
        return {'kind': kind, 'url': None}
    return {'kind': kind, 'url': doc.get('url')}


@router.post('/admin/help-videos/{kind}')
async def set_video(kind: str, body: VideoUrl, request: Request):
    await get_admin_user(request)
    if kind not in ALLOWED_KINDS:
        raise HTTPException(400, 'invalid kind')
    url = (body.url or '').strip()
    if not url:
        raise HTTPException(400, 'url required')
    await db.help_videos.update_one(
        {'_id': kind}, {'$set': {'url': url}}, upsert=True
    )
    return {'ok': True, 'kind': kind, 'url': url}


@router.delete('/admin/help-videos/{kind}')
async def delete_video(kind: str, request: Request):
    await get_admin_user(request)
    if kind not in ALLOWED_KINDS:
        raise HTTPException(400, 'invalid kind')
    await db.help_videos.delete_one({'_id': kind})
    return {'ok': True, 'kind': kind}
