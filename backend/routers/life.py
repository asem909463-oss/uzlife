"""My Life: reminders, plans, saved places, recommendations."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import sb
from core.deps import current_user
from routers.places import search_places

router = APIRouter(prefix="/life", tags=["life"])
TASHKENT = timezone(timedelta(hours=5))


class ReminderIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)
    due_at: str | None = None


class ReminderPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    notes: str | None = None
    due_at: str | None = None
    done: bool | None = None


class PlanItem(BaseModel):
    time: str | None = None
    text: str


class PlanIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: str | None = None
    items: list[PlanItem] = []
    notes: str | None = None


class SavedPlaceIn(BaseModel):
    place_id: str
    name: str
    address: str | None = None
    rating: float | None = None
    photo: str | None = None
    lat: float | None = None
    lng: float | None = None
    category: str | None = None
    maps_uri: str | None = None


def _own(user, extra: dict | None = None) -> dict:
    return {"user_id": f"eq.{user['id']}", **(extra or {})}


async def list_reminders_for(user_id: str) -> list[dict]:
    return await sb.rest("GET", "reminders", params={"user_id": f"eq.{user_id}", "select": "*",
                                                     "order": "done.asc,due_at.asc.nullslast,created_at.desc"})


# ---------- reminders ----------
@router.get("/reminders")
async def reminders(user: dict = Depends(current_user)):
    return await list_reminders_for(user["id"])


@router.post("/reminders")
async def create_reminder(body: ReminderIn, user: dict = Depends(current_user)):
    rows = await sb.rest("POST", "reminders", json={**body.model_dump(), "user_id": user["id"]}, prefer="return=representation")
    sb.log_event("reminder_created", user["id"])
    return rows[0]


@router.patch("/reminders/{rid}")
async def update_reminder(rid: str, body: ReminderPatch, user: dict = Depends(current_user)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    rows = await sb.rest("PATCH", "reminders", params=_own(user, {"id": f"eq.{rid}"}), json=patch, prefer="return=representation")
    if not rows:
        raise HTTPException(status_code=404, detail="not_found")
    return rows[0]


@router.delete("/reminders/{rid}")
async def delete_reminder(rid: str, user: dict = Depends(current_user)):
    await sb.rest("DELETE", "reminders", params=_own(user, {"id": f"eq.{rid}"}))
    return {"ok": True}


# ---------- plans ----------
@router.get("/plans")
async def plans(user: dict = Depends(current_user)):
    return await sb.rest("GET", "plans", params=_own(user, {"select": "*", "order": "date.desc.nullslast,created_at.desc"}))


@router.post("/plans")
async def create_plan(body: PlanIn, user: dict = Depends(current_user)):
    rows = await sb.rest("POST", "plans", json={**body.model_dump(), "user_id": user["id"]}, prefer="return=representation")
    sb.log_event("plan_created", user["id"])
    return rows[0]


@router.delete("/plans/{pid}")
async def delete_plan(pid: str, user: dict = Depends(current_user)):
    await sb.rest("DELETE", "plans", params=_own(user, {"id": f"eq.{pid}"}))
    return {"ok": True}


# ---------- saved places ----------
@router.get("/saved-places")
async def saved_places(user: dict = Depends(current_user)):
    return await sb.rest("GET", "saved_places", params=_own(user, {"select": "*", "order": "created_at.desc"}))


@router.post("/saved-places")
async def save_place(body: SavedPlaceIn, user: dict = Depends(current_user)):
    rows = await sb.rest("POST", "saved_places", json={**body.model_dump(), "user_id": user["id"]},
                         params={"on_conflict": "user_id,place_id"}, prefer="resolution=merge-duplicates,return=representation")
    sb.log_event("place_saved", user["id"])
    return rows[0]


@router.delete("/saved-places/{place_id}")
async def unsave_place(place_id: str, user: dict = Depends(current_user)):
    await sb.rest("DELETE", "saved_places", params=_own(user, {"place_id": f"eq.{place_id}"}))
    return {"ok": True}


# ---------- recommendations ----------
SLOTS = {
    "morning": {"ru": "лучший кофе и завтрак", "uz": "nonushta va qahva", "en": "best coffee and breakfast"},
    "lunch": {"ru": "обед бизнес-ланч ресторан", "uz": "tushlik restoran", "en": "lunch restaurant"},
    "afternoon": {"ru": "интересные места и музеи", "uz": "qiziqarli joylar va muzeylar", "en": "attractions and museums"},
    "evening": {"ru": "ужин ресторан с атмосферой", "uz": "kechki ovqat restoran", "en": "dinner restaurant with atmosphere"},
    "night": {"ru": "ночные заведения и лаунж", "uz": "tungi kafe lounge", "en": "late night lounge and cafe"},
}


@router.get("/recommendations")
async def recommendations(city: str = "tashkent", lang: str = "ru"):
    hour = datetime.now(TASHKENT).hour
    slot = "morning" if 6 <= hour < 11 else "lunch" if hour < 15 else "afternoon" if hour < 18 else "evening" if hour < 22 else "night"
    query = SLOTS[slot].get(lang, SLOTS[slot]["ru"])
    places = await search_places(query, city, lang, limit=8)
    return {"slot": slot, "query": query, "items": places}
