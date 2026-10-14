"""Uzlife API: modular FastAPI backend. Supabase (auth + data), Gemini, Google Places, Cloudinary."""
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import APIRouter, FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from core.deps import get_config  # noqa: E402
from routers import admin, ai, auth, life, market, news, places  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # request URLs may contain API keys


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(news.news_loop())
    yield
    task.cancel()


app = FastAPI(title="Uzlife API", lifespan=lifespan)
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"app": "uzlife", "status": "ok"}


@api.get("/config")
async def public_config():
    cfg = await get_config()
    return {"features": cfg["features"], "website_url": cfg.get("website_url") or "", "announcement": cfg.get("announcement") or ""}


for r in (auth.router, news.router, places.router, life.router, market.router, ai.router, admin.router):
    api.include_router(r)
app.include_router(api)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
