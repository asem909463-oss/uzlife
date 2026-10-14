"""Accounts: email/password via Supabase Auth, profile, account deletion."""
import os
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import sb
from core.deps import current_user

router = APIRouter(tags=["auth"])


async def delete_user_media(uid: str):
    """Best-effort removal of the user's Cloudinary folder."""
    try:
        await sb.http.delete(
            f"https://api.cloudinary.com/v1_1/{os.environ['CLOUDINARY_CLOUD_NAME']}/resources/image/upload",
            params={"prefix": f"uzlife/{uid}"},
            auth=(os.environ["CLOUDINARY_API_KEY"], os.environ["CLOUDINARY_API_SECRET"]))
    except Exception:
        pass
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SignupIn(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=72)
    name: str = Field(default="", max_length=80)
    language: str = "ru"


class LoginIn(BaseModel):
    email: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    language: str | None = None
    city: str | None = None
    interests: list[str] | None = None
    avatar_url: str | None = None


def _session(data: dict) -> dict:
    return {
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "expires_at": data.get("expires_at"),
        "user": {"id": data["user"]["id"], "email": data["user"].get("email")},
    }


async def _password_login(email: str, password: str) -> dict:
    r = await sb.auth("POST", "token?grant_type=password", json={"email": email, "password": password})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="invalid_credentials")
    return _session(r.json())


@router.post("/auth/signup")
async def signup(body: SignupIn):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="invalid_email")
    r = await sb.auth("POST", "admin/users", admin=True, json={
        "email": email, "password": body.password, "email_confirm": True,
        "user_metadata": {"name": body.name.strip()},
    })
    if r.status_code in (400, 409, 422):
        raise HTTPException(status_code=409, detail="email_exists")
    if r.status_code >= 300:
        raise HTTPException(status_code=502, detail="auth_provider_error")
    uid = r.json()["id"]
    await sb.rest("POST", "profiles", prefer="resolution=merge-duplicates", json={
        "id": uid, "name": body.name.strip() or email.split("@")[0],
        "language": body.language if body.language in ("ru", "uz", "en") else "ru",
    })
    sb.log_event("signup", uid)
    return await _password_login(email, body.password)


@router.post("/auth/login")
async def login(body: LoginIn):
    session = await _password_login(body.email.strip().lower(), body.password)
    sb.log_event("login", session["user"]["id"])
    return session


@router.post("/auth/refresh")
async def refresh(body: RefreshIn):
    r = await sb.auth("POST", "token?grant_type=refresh_token", json={"refresh_token": body.refresh_token})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="session_expired")
    return _session(r.json())


@router.get("/profile")
async def get_profile(user: dict = Depends(current_user)):
    rows = await sb.rest("GET", "profiles", params={"id": f"eq.{user['id']}", "select": "*"})
    if rows:
        return {**rows[0], "email": user["email"]}
    created = await sb.rest("POST", "profiles", prefer="return=representation",
                            json={"id": user["id"], "name": (user["email"] or "").split("@")[0]})
    return {**created[0], "email": user["email"]}


@router.patch("/profile")
async def update_profile(body: ProfileIn, user: dict = Depends(current_user)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if "language" in patch and patch["language"] not in ("ru", "uz", "en"):
        raise HTTPException(status_code=422, detail="invalid_language")
    rows = await sb.rest("PATCH", "profiles", params={"id": f"eq.{user['id']}"},
                         json={**patch, "updated_at": "now()"}, prefer="return=representation")
    return {**(rows[0] if rows else {}), "email": user["email"]}


@router.delete("/account")
async def delete_account(user: dict = Depends(current_user)):
    # Rows in user tables cascade-delete with the auth user; usage events and media are removed explicitly.
    await sb.rest("DELETE", "usage_events", params={"user_id": f"eq.{user['id']}"})
    await delete_user_media(user["id"])
    r = await sb.auth("DELETE", f"admin/users/{user['id']}", admin=True)
    if r.status_code >= 300:
        raise HTTPException(status_code=502, detail="auth_provider_error")
    return {"ok": True}
