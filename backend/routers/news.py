"""News: RSS aggregation with auto refresh, search, bookmarks, AI summary/translation."""
import asyncio
import hashlib
import html
import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone

import feedparser
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import llm, sb
from core.deps import current_user, require_feature

logger = logging.getLogger("uzlife.news")
router = APIRouter(tags=["news"], dependencies=[Depends(require_feature("news"))])

REFRESH_SECONDS = 600
STATE: dict = {"items": [], "by_id": {}, "updated_at": None, "last": 0.0, "lock": asyncio.Lock()}
AI_CACHE: dict[str, dict] = {}
TAG_RE = re.compile(r"<[^>]+>")
IMG_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.I)
P_RE = re.compile(r"<p[^>]*>(.*?)</p>", re.I | re.S)
UA = {"User-Agent": "Mozilla/5.0 (UzlifeBot; +https://uzlife.uz)"}


def _clean(text: str | None) -> str:
    return re.sub(r"\s+", " ", html.unescape(TAG_RE.sub(" ", text or ""))).strip()


def _image(entry) -> str | None:
    for key in ("media_content", "media_thumbnail"):
        for m in entry.get(key) or []:
            if m.get("url"):
                return m["url"]
    for enc in entry.get("enclosures") or []:
        if (enc.get("type") or "").startswith("image") and enc.get("href"):
            return enc["href"]
    raw = entry.get("summary", "") + "".join(c.get("value", "") for c in entry.get("content") or [])
    m = IMG_RE.search(raw)
    return m.group(1) if m else None


def _parse(source: dict, content: bytes) -> list[dict]:
    feed = feedparser.parse(content)
    out = []
    for e in feed.entries[:40]:
        link = e.get("link")
        if not link or not e.get("title"):
            continue
        t = e.get("published_parsed") or e.get("updated_parsed")
        published = datetime(*t[:6], tzinfo=timezone.utc) if t else datetime.now(timezone.utc)
        if published > datetime.now(timezone.utc) + timedelta(hours=1):
            published = datetime.now(timezone.utc)
        out.append({
            "id": hashlib.sha1(link.encode()).hexdigest()[:20],
            "title": _clean(e.title),
            "summary": _clean(e.get("summary"))[:400],
            "url": link,
            "image": _image(e),
            "source": source["name"],
            "category": source["category"],
            "region": source["region"],
            "lang": source.get("lang") or "en",
            "published_at": published.isoformat(),
        })
    return out


async def _fetch(source: dict) -> list[dict]:
    try:
        r = await sb.http.get(source["url"], headers=UA, timeout=15)
        r.raise_for_status()
        return _parse(source, r.content)
    except Exception as e:
        logger.warning("feed failed %s: %s", source["url"], e)
        return []


async def refresh_news(force: bool = False):
    if not force and time.time() - STATE["last"] < REFRESH_SECONDS and STATE["items"]:
        return
    async with STATE["lock"]:
        if not force and time.time() - STATE["last"] < REFRESH_SECONDS and STATE["items"]:
            return
        sources = await sb.rest("GET", "news_sources", params={"enabled": "eq.true", "select": "*"})
        results = await asyncio.gather(*[_fetch(s) for s in sources])
        seen, items = set(), []
        for item in sorted((i for batch in results for i in batch), key=lambda x: x["published_at"], reverse=True):
            if item["id"] not in seen:
                seen.add(item["id"])
                items.append(item)
        STATE.update(items=items, by_id={i["id"]: i for i in items}, last=time.time(),
                     updated_at=datetime.now(timezone.utc).isoformat())
        logger.info("news refreshed: %d items from %d sources", len(items), len(sources))


async def news_loop():
    while True:
        try:
            await refresh_news(force=True)
        except Exception as e:
            logger.error("news loop error: %s", e)
        await asyncio.sleep(REFRESH_SECONDS)


def _is_breaking(item: dict) -> bool:
    age = datetime.now(timezone.utc) - datetime.fromisoformat(item["published_at"])
    return age < timedelta(hours=3) and item["category"] in ("uzbekistan", "world")


def search_items(q: str, limit: int = 5) -> list[dict]:
    words = [w for w in q.lower().split() if len(w) > 2]
    scored = []
    for it in STATE["items"]:
        hay = (it["title"] + " " + it["summary"]).lower()
        score = sum(1 for w in words if w in hay)
        if score:
            scored.append((score, it))
    scored.sort(key=lambda x: (x[0], x[1]["published_at"]), reverse=True)
    return [it for _, it in scored[:limit]]


@router.get("/news")
async def list_news(category: str = "all", q: str = "", offset: int = 0, limit: int = 30):
    await refresh_news()
    items = STATE["items"]
    if category == "breaking":
        items = [i for i in items if _is_breaking(i)]
    elif category == "uzbekistan":
        items = [i for i in items if i["region"] == "uz"]
    elif category == "world":
        items = [i for i in items if i["category"] == "world"]
    elif category != "all":
        items = [i for i in items if i["category"] == category]
    if q.strip():
        ql = q.strip().lower()
        items = [i for i in items if ql in i["title"].lower() or ql in i["summary"].lower()]
    page = [{**i, "breaking": _is_breaking(i)} for i in items[offset: offset + min(limit, 50)]]
    return {"items": page, "total": len(items), "updated_at": STATE["updated_at"]}


@router.get("/news/article/{article_id}")
async def get_article(article_id: str):
    await refresh_news()
    item = STATE["by_id"].get(article_id)
    if not item:
        raise HTTPException(status_code=404, detail="not_found")
    return {**item, "breaking": _is_breaking(item)}


class AiIn(BaseModel):
    article_id: str
    lang: str = "ru"
    mode: str = "summary"  # summary | translate


async def _article_text(item: dict) -> str:
    try:
        r = await sb.http.get(item["url"], headers=UA, timeout=12)
        paras = [_clean(p) for p in P_RE.findall(r.text)]
        text = " ".join(p for p in paras if len(p) > 60)
        if len(text) > 300:
            return text[:6000]
    except Exception as e:
        logger.info("article fetch failed: %s", e)
    return item["summary"]


@router.post("/news/ai")
async def news_ai(body: AiIn):
    item = STATE["by_id"].get(body.article_id)
    if not item:
        raise HTTPException(status_code=404, detail="not_found")
    key = f"{body.article_id}:{body.lang}:{body.mode}"
    if key in AI_CACHE:
        return AI_CACHE[key]
    lang = llm.LANG_NAMES.get(body.lang, "Russian")
    text = await _article_text(item)
    if body.mode == "translate":
        task = (f"Translate the article into {lang}. Return JSON: {{\"title\": str, \"text\": str}} where text is a faithful, "
                f"readable translation of the article body (max 600 words, paragraphs separated by \\n\\n).")
    else:
        task = (f"Summarize the article in {lang}. Return JSON: {{\"title\": str (translated headline), "
                f"\"bullets\": [3-5 short factual bullet strings], \"why_it_matters\": str (1 sentence for people in Uzbekistan)}}.")
    system = "You are a precise news editor. Use only facts from the provided article. Output only valid JSON, no markdown."
    raw = await llm.complete(system, f"{task}\n\nHEADLINE: {item['title']}\nSOURCE: {item['source']}\nARTICLE:\n{text}")
    m = re.search(r"\{.*\}", raw, re.S)
    try:
        data = json.loads(m.group(0)) if m else {}
    except json.JSONDecodeError:
        data = {}
    if not data:
        raise HTTPException(status_code=502, detail="ai_failed")
    result = {"mode": body.mode, "lang": body.lang, **data}
    AI_CACHE[key] = result
    sb.log_event("news_ai", None, {"mode": body.mode})
    return result


class BookmarkIn(BaseModel):
    article_id: str
    title: str
    url: str
    source: str | None = None
    image: str | None = None
    category: str | None = None
    published_at: str | None = None


@router.get("/news/bookmarks")
async def list_bookmarks(user: dict = Depends(current_user)):
    return await sb.rest("GET", "news_bookmarks", params={"user_id": f"eq.{user['id']}", "select": "*", "order": "created_at.desc"})


@router.post("/news/bookmarks")
async def add_bookmark(body: BookmarkIn, user: dict = Depends(current_user)):
    rows = await sb.rest("POST", "news_bookmarks", json={**body.model_dump(), "user_id": user["id"]},
                         params={"on_conflict": "user_id,article_id"},
                         prefer="resolution=merge-duplicates,return=representation")
    return rows[0]


@router.delete("/news/bookmarks/{article_id}")
async def remove_bookmark(article_id: str, user: dict = Depends(current_user)):
    await sb.rest("DELETE", "news_bookmarks", params={"user_id": f"eq.{user['id']}", "article_id": f"eq.{article_id}"})
    return {"ok": True}
