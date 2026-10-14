"""Flash AI: streaming Gemini assistant with verified read actions and confirm-first write actions."""
import json
import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core import llm, sb
from core.deps import current_user, current_user_optional, require_feature
from routers import news as news_mod
from routers.life import TASHKENT, list_reminders_for
from routers.places import CITIES, search_places

logger = logging.getLogger("uzlife.ai")
router = APIRouter(prefix="/ai", tags=["ai"])
ACTION_RE = re.compile(r"<action>(.*?)</action>", re.S)
WRITE_ACTIONS = {"create_reminder", "create_plan"}


class Msg(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[Msg] = []
    lang: str = "ru"
    city: str = "tashkent"


SYSTEM = """You are Flash, the AI assistant inside Uzlife, a super-app for people living in Uzbekistan.
Now in Tashkent (UTC+5): {now} ({weekday}). User city: {city}. User is {who}.
Always reply in {lang}. Tone: calm, warm, concise executive assistant. Use short paragraphs; you may use "- " bullets and **bold**.

You can run app actions. When an action helps, append EXACTLY ONE block at the very end of the reply:
<action>{{JSON}}</action>
Supported actions:
- {{"type":"search_places","query":"<Google Maps query incl. city>"}} find restaurants, cafes, shops, services, activities.
- {{"type":"search_news","query":"<2-4 keywords in the language of likely sources>"}} find fresh news in the app feed.
- {{"type":"list_reminders"}} show the user's reminders.
- {{"type":"create_reminder","title":"...","due_at":"YYYY-MM-DDTHH:MM:00+05:00","notes":"..."}} needs user confirmation.
- {{"type":"create_plan","title":"...","date":"YYYY-MM-DD","items":[{{"time":"HH:MM","text":"..."}}]}} needs user confirmation.
- {{"type":"open_screen","screen":"explore|news|life|services|market"}}
Rules:
- Never claim a create action is done; say you prepared it and ask the user to confirm the card below.
- For searches, say briefly what you are looking up; verified results appear below your message.
- Never invent places, addresses, phone numbers, prices or news; use actions instead.
- Resolve relative dates ("tomorrow", "in 2 hours") from the current Tashkent time.
User's open reminders: {reminders}"""


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


async def _run_action(action: dict, user: dict | None, body: ChatIn) -> dict:
    kind = action.get("type")
    if kind == "search_places":
        items = await search_places(str(action.get("query", ""))[:120], body.city, body.lang, limit=5)
        return {"kind": "places", "items": items, "verified": True}
    if kind == "search_news":
        await news_mod.refresh_news()
        return {"kind": "news", "items": news_mod.search_items(str(action.get("query", ""))), "verified": True}
    if kind == "list_reminders":
        if not user:
            return {"kind": "auth_required"}
        rows = [r for r in await list_reminders_for(user["id"]) if not r["done"]][:8]
        return {"kind": "reminders", "items": rows, "verified": True}
    if kind in WRITE_ACTIONS:
        return {"kind": "confirm", "requires_auth": user is None}
    if kind == "open_screen":
        return {"kind": "navigate"}
    return {"kind": "unsupported"}


@router.post("/chat", dependencies=[Depends(require_feature("flash_ai"))])
async def chat(body: ChatIn, user: dict | None = Depends(current_user_optional)):
    now = datetime.now(TASHKENT)
    reminders = "none"
    if user:
        open_r = [r for r in await list_reminders_for(user["id"]) if not r["done"]][:6]
        reminders = "; ".join(f"{r['title']} @ {r.get('due_at') or 'no time'}" for r in open_r) or "none"
    system = SYSTEM.format(now=now.strftime("%Y-%m-%d %H:%M"), weekday=now.strftime("%A"),
                           city=body.city if body.city in CITIES else "tashkent",
                           who="signed in" if user else "a guest (creating reminders/plans requires sign-in)",
                           lang=llm.LANG_NAMES.get(body.lang, "Russian"), reminders=reminders)
    transcript = "\n".join(f"{m.role.upper()}: {m.content[:1500]}" for m in body.history[-12:])
    prompt = (f"Conversation so far:\n{transcript}\n\n" if transcript else "") + f"USER: {body.message}"
    if user:
        sb.log_event("ai_chat", user["id"])
        await sb.rest("POST", "chat_messages", json={"user_id": user["id"], "role": "user", "content": body.message})
    else:
        sb.log_event("ai_chat_guest")

    async def gen():
        full, sent = "", 0
        try:
            async for chunk in llm.stream(system, prompt):
                full += chunk
                cut = full.find("<action")
                safe_end = cut if cut != -1 else max(len(full) - 8, sent)
                if safe_end > sent:
                    yield _sse({"type": "delta", "text": full[sent:safe_end]})
                    sent = safe_end
            text_end = full.find("<action")
            visible = (full if text_end == -1 else full[:text_end]).rstrip()
            if len(visible) > sent:
                yield _sse({"type": "delta", "text": visible[sent:]})
            m = ACTION_RE.search(full)
            if m:
                try:
                    action = json.loads(m.group(1).strip())
                    result = await _run_action(action, user, body)
                    yield _sse({"type": "action", "action": action, "result": result})
                except (json.JSONDecodeError, Exception) as e:  # bad action must not kill the reply
                    logger.warning("action failed: %s", e)
                    yield _sse({"type": "action_error"})
            if user and visible:
                await sb.rest("POST", "chat_messages", json={"user_id": user["id"], "role": "assistant", "content": visible})
            yield _sse({"type": "done"})
        except Exception as e:
            logger.error("chat stream error: %s", e)
            yield _sse({"type": "error", "message": "ai_unavailable"})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/history")
async def history(user: dict = Depends(current_user)):
    rows = await sb.rest("GET", "chat_messages", params={"user_id": f"eq.{user['id']}", "select": "role,content,created_at",
                                                         "order": "created_at.desc", "limit": "40"})
    return list(reversed(rows))


@router.delete("/history")
async def clear_history(user: dict = Depends(current_user)):
    await sb.rest("DELETE", "chat_messages", params={"user_id": f"eq.{user['id']}"})
    return {"ok": True}
