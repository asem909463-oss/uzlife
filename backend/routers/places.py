"""Explore: Google Places API (New). The API key never leaves the server."""
import os
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from core import sb
from core.deps import require_feature

router = APIRouter(tags=["places"])
GOOGLE_KEY = os.environ["GOOGLE_API_KEY"]
BASE = "https://places.googleapis.com/v1"

CITIES = {
    "tashkent": (41.2995, 69.2401), "samarkand": (39.6542, 66.9597), "bukhara": (39.7747, 64.4286),
    "namangan": (41.0011, 71.6683), "andijan": (40.7821, 72.3442), "fergana": (40.3864, 71.7864),
    "nukus": (42.4531, 59.6103), "khiva": (41.3783, 60.3639),
}
LIST_FIELDS = ",".join(f"places.{f}" for f in [
    "id", "displayName", "formattedAddress", "rating", "userRatingCount", "priceLevel", "photos",
    "location", "primaryTypeDisplayName", "currentOpeningHours.openNow", "googleMapsUri"])
DETAIL_FIELDS = ",".join([
    "id", "displayName", "formattedAddress", "rating", "userRatingCount", "priceLevel", "photos", "location",
    "primaryTypeDisplayName", "currentOpeningHours", "regularOpeningHours.weekdayDescriptions",
    "internationalPhoneNumber", "websiteUri", "googleMapsUri", "editorialSummary", "reviews"])
_cache: dict[str, tuple[object, float]] = {}


def _norm(p: dict) -> dict:
    loc = p.get("location") or {}
    return {
        "id": p["id"],
        "name": (p.get("displayName") or {}).get("text", ""),
        "address": p.get("formattedAddress"),
        "rating": p.get("rating"),
        "reviews_count": p.get("userRatingCount"),
        "price_level": p.get("priceLevel"),
        "type": (p.get("primaryTypeDisplayName") or {}).get("text"),
        "open_now": (p.get("currentOpeningHours") or {}).get("openNow"),
        "photo": (p.get("photos") or [{}])[0].get("name"),
        "lat": loc.get("latitude"),
        "lng": loc.get("longitude"),
        "maps_uri": p.get("googleMapsUri"),
    }


async def search_places(query: str, city: str = "tashkent", lang: str = "ru", open_now: bool = False, limit: int = 20) -> list[dict]:
    key = f"s:{query}:{city}:{lang}:{open_now}:{limit}"
    hit = _cache.get(key)
    if hit and hit[1] > time.time():
        return hit[0]
    lat, lng = CITIES.get(city, CITIES["tashkent"])
    body = {"textQuery": query, "languageCode": lang, "regionCode": "UZ", "maxResultCount": limit,
            "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 20000.0}}}
    if open_now:
        body["openNow"] = True
    r = await sb.http.post(f"{BASE}/places:searchText", json=body,
                           headers={"X-Goog-Api-Key": GOOGLE_KEY, "X-Goog-FieldMask": LIST_FIELDS})
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="places_error")
    places = [_norm(p) for p in r.json().get("places", [])]
    _cache[key] = (places, time.time() + 600)
    return places


@router.get("/places/search", dependencies=[Depends(require_feature("explore"))])
async def places_search(q: str, city: str = "tashkent", lang: str = "ru", open_now: bool = False):
    if not q.strip():
        raise HTTPException(status_code=422, detail="query_required")
    sb.log_event("places_search", None, {"q": q[:60], "city": city})
    return {"items": await search_places(q.strip(), city, lang, open_now)}


@router.get("/places/photo")
async def place_photo(name: str, w: int = 800):
    if not name.startswith("places/"):
        raise HTTPException(status_code=422, detail="invalid_photo")
    key = f"p:{name}:{w}"
    hit = _cache.get(key)
    if not hit or hit[1] < time.time():
        r = await sb.http.get(f"{BASE}/{name}/media", params={"maxWidthPx": min(w, 1600), "skipHttpRedirect": "true", "key": GOOGLE_KEY})
        if r.status_code != 200:
            raise HTTPException(status_code=404, detail="photo_not_found")
        hit = (r.json()["photoUri"], time.time() + 3000)
        _cache[key] = hit
    return RedirectResponse(hit[0], status_code=302)


@router.get("/places/{place_id}", dependencies=[Depends(require_feature("explore"))])
async def place_detail(place_id: str, lang: str = "ru"):
    r = await sb.http.get(f"{BASE}/places/{place_id}", params={"languageCode": lang},
                          headers={"X-Goog-Api-Key": GOOGLE_KEY, "X-Goog-FieldMask": DETAIL_FIELDS})
    if r.status_code != 200:
        raise HTTPException(status_code=404 if r.status_code == 404 else 502, detail="place_not_found")
    p = r.json()
    return {
        **_norm(p),
        "photos": [ph["name"] for ph in (p.get("photos") or [])[:8]],
        "phone": p.get("internationalPhoneNumber"),
        "website": p.get("websiteUri"),
        "summary": (p.get("editorialSummary") or {}).get("text"),
        "hours": (p.get("regularOpeningHours") or {}).get("weekdayDescriptions") or [],
        "open_now": (p.get("currentOpeningHours") or {}).get("openNow"),
        "reviews": [{
            "author": (rv.get("authorAttribution") or {}).get("displayName"),
            "rating": rv.get("rating"),
            "text": (rv.get("text") or rv.get("originalText") or {}).get("text", ""),
            "when": rv.get("relativePublishTimeDescription"),
        } for rv in (p.get("reviews") or [])[:5]],
    }
