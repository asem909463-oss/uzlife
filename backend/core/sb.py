"""Supabase access (server-side, service role). Keys come only from env."""
import asyncio
import logging
import os

import httpx
from fastapi import HTTPException

logger = logging.getLogger("uzlife.sb")

SB_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

http = httpx.AsyncClient(timeout=25, follow_redirects=True)


def _headers(prefer: str | None = None) -> dict:
    h = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    return h


async def rest(method: str, table: str, params: dict | None = None, json=None, prefer: str | None = None):
    r = await http.request(method, f"{SB_URL}/rest/v1/{table}", params=params, json=json, headers=_headers(prefer))
    if r.status_code >= 400:
        logger.error("Supabase %s %s -> %s %s", method, table, r.status_code, r.text[:300])
        raise HTTPException(status_code=502 if r.status_code >= 500 else 400, detail="database_error")
    return r.json() if r.content else None


async def count(table: str, params: dict | None = None) -> int:
    p = {**(params or {}), "select": "id", "limit": "1"}
    r = await http.get(f"{SB_URL}/rest/v1/{table}", params=p, headers=_headers("count=exact"))
    total = r.headers.get("content-range", "*/0").split("/")[-1]
    return int(total) if total.isdigit() else 0


async def auth(method: str, path: str, json=None, token: str | None = None, admin: bool = False) -> httpx.Response:
    key = SERVICE_KEY if admin else ANON_KEY
    headers = {"apikey": key, "Authorization": f"Bearer {token or key}"}
    return await http.request(method, f"{SB_URL}/auth/v1/{path}", json=json, headers=headers)


def log_event(event: str, user_id: str | None = None, meta: dict | None = None):
    """Fire-and-forget usage tracking."""
    async def _go():
        try:
            await rest("POST", "usage_events", json={"event": event, "user_id": user_id, "meta": meta or {}})
        except Exception as e:  # tracking must never break a request
            logger.warning("usage log failed: %s", e)
    asyncio.create_task(_go())
