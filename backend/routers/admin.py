"""Admin: password login (hash in env), stats, news sources, feature flags, website URL, moderation."""
import hashlib
import hmac
import os
import re
import time
from collections import Counter
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from core import sb
from core.deps import ADMIN_JWT_SECRET, get_config, invalidate_config, require_admin
from routers import news

router = APIRouter(prefix="/admin", tags=["admin"])
SALT = bytes.fromhex(os.environ["ADMIN_PASSWORD_SALT"])
HASH = os.environ["ADMIN_PASSWORD_HASH"]
_attempts: dict[str, list[float]] = {}
guard = [Depends(require_admin)]


class LoginIn(BaseModel):
    password: str = Field(max_length=128)


class SourceIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    url: str = Field(min_length=8, max_length=500)
    category: str = "world"
    region: str = "world"
    lang: str = "en"
    enabled: bool = True


class SourcePatch(BaseModel):
    enabled: bool | None = None
    name: str | None = None
    category: str | None = None


class ConfigIn(BaseModel):
    features: dict[str, bool] | None = None
    website_url: str | None = None
    announcement: str | None = None
    support_email: str | None = None


class ServiceIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str
    description: str | None = None
    phone: str | None = None
    website: str | None = None
    sort: int = 100


@router.post("/login")
async def admin_login(body: LoginIn, request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0]
    now = time.time()
    recent = [t for t in _attempts.get(ip, []) if now - t < 900]
    if len(recent) >= 5:
        raise HTTPException(status_code=429, detail="too_many_attempts")
    digest = hashlib.pbkdf2_hmac("sha256", body.password.encode(), SALT, 200_000).hex()
    if not hmac.compare_digest(digest, HASH):
        _attempts[ip] = recent + [now]
        raise HTTPException(status_code=401, detail="invalid_password")
    _attempts.pop(ip, None)
    token = jwt.encode({"role": "admin", "exp": datetime.now(timezone.utc) + timedelta(hours=8)}, ADMIN_JWT_SECRET, algorithm="HS256")
    sb.log_event("admin_login")
    return {"token": token}


@router.get("/stats", dependencies=guard)
async def stats():
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    events = await sb.rest("GET", "usage_events", params={"select": "event,created_at", "created_at": f"gte.{since}",
                                                          "order": "created_at.desc", "limit": "5000"})
    by_event = Counter(e["event"] for e in events)
    by_day = Counter(e["created_at"][:10] for e in events)
    return {
        "users": await sb.count("profiles"),
        "reminders": await sb.count("reminders"),
        "plans": await sb.count("plans"),
        "listings": await sb.count("market_listings"),
        "bookmarks": await sb.count("news_bookmarks"),
        "news_items": len(news.STATE["items"]),
        "news_updated_at": news.STATE["updated_at"],
        "events_7d": sum(by_event.values()),
        "by_event": dict(by_event.most_common()),
        "by_day": dict(sorted(by_day.items())),
    }


@router.get("/sources", dependencies=guard)
async def sources():
    return await sb.rest("GET", "news_sources", params={"select": "*", "order": "region.asc,name.asc"})


@router.post("/sources", dependencies=guard)
async def add_source(body: SourceIn):
    rows = await sb.rest("POST", "news_sources", json=body.model_dump(), prefer="return=representation")
    await news.refresh_news(force=True)
    return rows[0]


@router.patch("/sources/{sid}", dependencies=guard)
async def patch_source(sid: str, body: SourcePatch):
    rows = await sb.rest("PATCH", "news_sources", params={"id": f"eq.{sid}"},
                         json={k: v for k, v in body.model_dump().items() if v is not None}, prefer="return=representation")
    await news.refresh_news(force=True)
    return rows[0] if rows else {}


@router.delete("/sources/{sid}", dependencies=guard)
async def delete_source(sid: str):
    await sb.rest("DELETE", "news_sources", params={"id": f"eq.{sid}"})
    await news.refresh_news(force=True)
    return {"ok": True}


@router.post("/news/refresh", dependencies=guard)
async def force_refresh():
    await news.refresh_news(force=True)
    return {"items": len(news.STATE["items"]), "updated_at": news.STATE["updated_at"]}


@router.get("/config", dependencies=guard)
async def admin_config():
    return await get_config(force=True)


@router.put("/config", dependencies=guard)
async def update_config(body: ConfigIn):
    current = await get_config(force=True)
    updates = {}
    if body.features is not None:
        updates["features"] = {**current["features"], **body.features}
    if body.website_url is not None:
        if body.website_url and not body.website_url.startswith(("https://", "http://")):
            raise HTTPException(status_code=422, detail="invalid_url")
        updates["website_url"] = body.website_url
    if body.support_email is not None:
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", body.support_email.strip()):
            raise HTTPException(status_code=422, detail="invalid_email")
        updates["support_email"] = body.support_email.strip()
    if body.announcement is not None:
        updates["announcement"] = body.announcement[:300]
    if updates:
        await sb.rest("POST", "app_config", prefer="resolution=merge-duplicates",
                      json=[{"key": k, "value": v, "updated_at": datetime.now(timezone.utc).isoformat()} for k, v in updates.items()])
    invalidate_config()
    return await get_config(force=True)


@router.get("/listings", dependencies=guard)
async def admin_listings():
    return await sb.rest("GET", "market_listings", params={"select": "*", "order": "created_at.desc", "limit": "100"})


@router.delete("/listings/{lid}", dependencies=guard)
async def admin_delete_listing(lid: str):
    await sb.rest("DELETE", "market_listings", params={"id": f"eq.{lid}"})
    return {"ok": True}


@router.get("/services", dependencies=guard)
async def admin_services():
    return await sb.rest("GET", "services", params={"select": "*", "order": "sort.asc"})


@router.post("/services", dependencies=guard)
async def admin_add_service(body: ServiceIn):
    rows = await sb.rest("POST", "services", json=body.model_dump(), prefer="return=representation")
    return rows[0]


@router.delete("/services/{sid}", dependencies=guard)
async def admin_delete_service(sid: str):
    await sb.rest("DELETE", "services", params={"id": f"eq.{sid}"})
    return {"ok": True}


@router.get("/reports", dependencies=guard)
async def reports():
    return await sb.rest("GET", "usage_events", params={"event": "eq.report", "select": "id,meta,created_at", "order": "created_at.desc", "limit": "100"})


@router.delete("/reports/{rid}", dependencies=guard)
async def dismiss_report(rid: int):
    await sb.rest("DELETE", "usage_events", params={"id": f"eq.{rid}", "event": "eq.report"})
    return {"ok": True}


@router.post("/users/{uid}/ban", dependencies=guard)
async def ban_user(uid: str):
    """Ban an abusive user: block sign-in and remove all their listings."""
    r = await sb.auth("PUT", f"admin/users/{uid}", admin=True, json={"ban_duration": "876000h"})
    if r.status_code >= 300:
        raise HTTPException(status_code=502, detail="auth_provider_error")
    await sb.rest("DELETE", "market_listings", params={"user_id": f"eq.{uid}"})
    sb.log_event("admin_ban")
    return {"ok": True}
