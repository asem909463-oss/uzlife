"""Services directory, marketplace listings and Cloudinary signed uploads."""
import hashlib
import os
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import sb
from core.deps import current_user, require_feature

router = APIRouter(tags=["market"])

# Basic automatic filter for objectionable marketplace content (App Store guideline 1.2).
BANNED = [
    "fuck", "shit", "bitch", "porn", "sex service", "escort", "cocaine", "heroin", "weed", "marijuana", "gun for sale",
    "хуй", "хуё", "пизд", "ебат", "ебан", "бляд", "сука", "порно", "интим", "эскорт", "наркот", "кокаин", "героин", "мефедрон", "закладк", "оружие",
    "jalab", "qotoq", "giyohvand", "fohisha",
]


def is_objectionable(*texts: str | None) -> bool:
    hay = " ".join(t.lower() for t in texts if t)
    return any((f" {w}" in f" {hay}") for w in BANNED)


class ReportIn(BaseModel):
    reason: str = Field(min_length=2, max_length=300)
CLD_NAME = os.environ["CLOUDINARY_CLOUD_NAME"]
CLD_KEY = os.environ["CLOUDINARY_API_KEY"]
CLD_SECRET = os.environ["CLOUDINARY_API_SECRET"]


class ListingIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    price: float | None = Field(default=None, ge=0)
    currency: str = "UZS"
    category: str = "other"
    city: str = "tashkent"
    contact: str = Field(min_length=3, max_length=120)
    image_url: str | None = None


@router.get("/services", dependencies=[Depends(require_feature("services"))])
async def services(category: str | None = None):
    params = {"active": "eq.true", "select": "*", "order": "sort.asc,name.asc"}
    if category:
        params["category"] = f"eq.{category}"
    return await sb.rest("GET", "services", params=params)


@router.get("/market/listings", dependencies=[Depends(require_feature("marketplace"))])
async def listings(category: str | None = None, q: str = "", city: str | None = None, limit: int = 50):
    params = {"status": "eq.active", "select": "*", "order": "created_at.desc", "limit": str(min(limit, 100))}
    if category and category != "all":
        params["category"] = f"eq.{category}"
    if city:
        params["city"] = f"eq.{city}"
    if q.strip():
        safe = q.strip().replace(",", " ").replace("(", " ").replace(")", " ")
        params["or"] = f"(title.ilike.*{safe}*,description.ilike.*{safe}*)"
    return await sb.rest("GET", "market_listings", params=params)


@router.get("/market/mine")
async def my_listings(user: dict = Depends(current_user)):
    return await sb.rest("GET", "market_listings", params={"user_id": f"eq.{user['id']}", "select": "*", "order": "created_at.desc"})


@router.get("/market/listings/{lid}")
async def listing(lid: str):
    rows = await sb.rest("GET", "market_listings", params={"id": f"eq.{lid}", "select": "*"})
    if not rows:
        raise HTTPException(status_code=404, detail="not_found")
    return rows[0]


@router.post("/market/listings", dependencies=[Depends(require_feature("marketplace"))])
async def create_listing(body: ListingIn, user: dict = Depends(current_user)):
    if is_objectionable(body.title, body.description, body.contact):
        raise HTTPException(status_code=422, detail="objectionable_content")
    rows = await sb.rest("POST", "market_listings", json={**body.model_dump(), "user_id": user["id"]}, prefer="return=representation")
    sb.log_event("listing_created", user["id"])
    return rows[0]


@router.delete("/market/listings/{lid}")
async def delete_listing(lid: str, user: dict = Depends(current_user)):
    await sb.rest("DELETE", "market_listings", params={"id": f"eq.{lid}", "user_id": f"eq.{user['id']}"})
    return {"ok": True}


@router.post("/market/listings/{lid}/report")
async def report_listing(lid: str, body: ReportIn, user: dict = Depends(current_user)):
    rows = await sb.rest("GET", "market_listings", params={"id": f"eq.{lid}", "select": "id,title,user_id"})
    if not rows:
        raise HTTPException(status_code=404, detail="not_found")
    await sb.rest("POST", "usage_events", json={"event": "report", "user_id": user["id"], "meta": {
        "listing_id": lid, "title": rows[0]["title"], "owner_id": rows[0]["user_id"], "reason": body.reason}})
    return {"ok": True}


@router.post("/media/sign")
async def sign_upload(user: dict = Depends(current_user)):
    """Signature for a direct client -> Cloudinary upload; the secret stays on the server."""
    ts = int(time.time())
    folder = f"uzlife/{user['id']}"
    to_sign = f"folder={folder}&timestamp={ts}"
    signature = hashlib.sha1((to_sign + CLD_SECRET).encode()).hexdigest()
    return {"cloud_name": CLD_NAME, "api_key": CLD_KEY, "timestamp": ts, "folder": folder, "signature": signature}
