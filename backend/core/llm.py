"""Gemini via emergentintegrations (streaming)."""
import os
import uuid

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL = ("gemini", "gemini-3-flash-preview")
LANG_NAMES = {"ru": "Russian", "uz": "Uzbek (Latin script)", "en": "English"}


def _chat(system: str) -> LlmChat:
    return LlmChat(api_key=LLM_KEY, session_id=uuid.uuid4().hex, system_message=system).with_model(*MODEL)


async def stream(system: str, text: str):
    async for ev in _chat(system).stream_message(UserMessage(text=text)):
        if isinstance(ev, TextDelta):
            yield ev.content
        elif isinstance(ev, StreamDone):
            break


async def complete(system: str, text: str) -> str:
    return "".join([chunk async for chunk in stream(system, text)])
