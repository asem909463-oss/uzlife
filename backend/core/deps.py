"""Auth dependencies, app config and feature flags."""
import os
import time

import jwt
from fastapi import Depends, Header, HTTPException

from core import sb

_user_cache: dict[str, tuple[dict, float]] = {}
_config_cache: dict = {"data": None, "exp": 0.0}
ADMIN_JWT_SECRET = os.environ["ADMIN_JWT_SECRET"]

DEFAULT_FEATURES = {"flash_ai": True, "explore": True, "news": True, "services": True, "marketplace": True}


async def current_user_optional(authorization: str | None = Header(None)) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:]
    now = time.time()
    cached = _user_cache.get(token)
    if cached and cached[1] > now:
        return cached[0]
    r = await sb.auth("GET", "user", token=token)
    if r.status_code != 200:
        return None
    u = r.json()
    user = {"id": u["id"], "email": u.get("email")}
    _user_cache[token] = (user, now + 120)
    return user


async def current_user(user: dict | None = Depends(current_user_optional)) -> dict:
    if not user:
        raise HTTPException(status_code=401, detail="auth_required")
    return user


async def get_config(force: bool = False) -> dict:
    now = time.time()
    if not force and _config_cache["data"] and _config_cache["exp"] > now:
        return _config_cache["data"]
    rows = await sb.rest("GET", "app_config", params={"select": "key,value"})
    data = {r["key"]: r["value"] for r in rows}
    data["features"] = {**DEFAULT_FEATURES, **(data.get("features") or {})}
    _config_cache.update(data=data, exp=now + 30)
    return data


def invalidate_config():
    _config_cache["exp"] = 0.0


def require_feature(name: str):
    async def _dep():
        cfg = await get_config()
        if not cfg["features"].get(name, True):
            raise HTTPException(status_code=403, detail="feature_disabled")
    return _dep


async def require_admin(x_admin_token: str | None = Header(None)) -> bool:
    if not x_admin_token:
        raise HTTPException(status_code=401, detail="admin_required")
    try:
        payload = jwt.decode(x_admin_token, ADMIN_JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="admin_session_invalid")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="forbidden")
    return True
