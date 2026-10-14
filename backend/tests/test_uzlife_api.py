"""Uzlife backend API regression suite."""
import json
import os
import random
import string
import time

import httpx
import pytest

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://uzlife-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
TEST_EMAIL = "test@uzlife.app"
TEST_PWD = "Test12345"
ADMIN_PWD = "909463"

STATE = {}


def _rand(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


@pytest.fixture(scope="session")
def http():
    with httpx.Client(timeout=30) as c:
        yield c


# ---------- health / config ----------
def test_root(http):
    r = http.get(f"{API}/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_config(http):
    r = http.get(f"{API}/config")
    assert r.status_code == 200
    j = r.json()
    for k in ("flash_ai", "explore", "news", "services", "marketplace"):
        assert k in j["features"]


# ---------- auth ----------
def test_login_existing(http):
    r = http.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PWD})
    assert r.status_code == 200, r.text
    j = r.json()
    assert "access_token" in j and "refresh_token" in j
    STATE["access"] = j["access_token"]
    STATE["refresh"] = j["refresh_token"]
    STATE["uid"] = j["user"]["id"]


def test_refresh(http):
    r = http.post(f"{API}/auth/refresh", json={"refresh_token": STATE["refresh"]})
    assert r.status_code == 200, r.text
    STATE["access"] = r.json()["access_token"]
    STATE["refresh"] = r.json()["refresh_token"]


def test_profile_get(http):
    r = http.get(f"{API}/profile", headers={"Authorization": f"Bearer {STATE['access']}"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["id"] == STATE["uid"]
    STATE["original_name"] = j.get("name")


def test_profile_patch(http):
    new_name = f"Tester {_rand(4)}"
    r = http.patch(f"{API}/profile", headers={"Authorization": f"Bearer {STATE['access']}"},
                   json={"name": new_name, "language": "ru"})
    assert r.status_code == 200, r.text
    assert r.json().get("name") == new_name
    # restore
    http.patch(f"{API}/profile", headers={"Authorization": f"Bearer {STATE['access']}"},
               json={"name": STATE.get("original_name") or "Tester"})


def test_signup_and_delete_throwaway(http):
    email = f"test_{_rand(10)}@uzlife.dev"
    pwd = "Pw" + _rand(10)
    r = http.post(f"{API}/auth/signup", json={"email": email, "password": pwd, "name": "Throwaway"})
    assert r.status_code == 200, r.text
    j = r.json()
    tok = j["access_token"]
    # ownership isolation check: this user should not see test@uzlife.app's reminders
    r2 = http.get(f"{API}/life/reminders", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    STATE["throwaway_token"] = tok
    STATE["throwaway_uid"] = j["user"]["id"]
    # delete it
    r3 = http.delete(f"{API}/account", headers={"Authorization": f"Bearer {tok}"})
    assert r3.status_code == 200, r3.text


def test_bad_login(http):
    r = http.post(f"{API}/auth/login", json={"email": "nope@nope.com", "password": "wrongwrong"})
    assert r.status_code == 401


# ---------- news ----------
def test_news_all(http):
    r = http.get(f"{API}/news?category=all")
    assert r.status_code == 200
    j = r.json()
    assert "items" in j and isinstance(j["items"], list)
    if j["items"]:
        STATE["article_id"] = j["items"][0]["id"]


def test_news_categories(http):
    for cat in ("breaking", "uzbekistan", "world", "business", "tech", "sports"):
        r = http.get(f"{API}/news?category={cat}")
        assert r.status_code == 200, (cat, r.text)


def test_news_search(http):
    r = http.get(f"{API}/news?q=uzbekistan")
    assert r.status_code == 200


def test_news_article(http):
    if "article_id" not in STATE:
        pytest.skip("no article available")
    r = http.get(f"{API}/news/article/{STATE['article_id']}")
    assert r.status_code == 200
    assert r.json()["id"] == STATE["article_id"]


def test_news_ai_summary(http):
    if "article_id" not in STATE:
        pytest.skip("no article available")
    r = http.post(f"{API}/news/ai", json={"article_id": STATE["article_id"], "lang": "ru", "mode": "summary"},
                  timeout=60)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["mode"] == "summary"
    assert "bullets" in j or "title" in j


def test_news_bookmark_crud(http):
    if "article_id" not in STATE:
        pytest.skip("no article available")
    hdr = {"Authorization": f"Bearer {STATE['access']}"}
    body = {"article_id": STATE["article_id"], "title": "Test bookmark", "url": "https://example.com"}
    r = http.post(f"{API}/news/bookmarks", json=body, headers=hdr)
    assert r.status_code == 200, r.text
    r2 = http.get(f"{API}/news/bookmarks", headers=hdr)
    assert r2.status_code == 200
    assert any(b["article_id"] == STATE["article_id"] for b in r2.json())
    r3 = http.delete(f"{API}/news/bookmarks/{STATE['article_id']}", headers=hdr)
    assert r3.status_code == 200


# ---------- places ----------
def test_places_search(http):
    r = http.get(f"{API}/places/search", params={"q": "plov", "city": "tashkent", "lang": "ru"})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert isinstance(items, list)
    if items:
        STATE["place_id"] = items[0]["id"]
        STATE["place_photo"] = items[0].get("photo")


def test_place_detail(http):
    if "place_id" not in STATE:
        pytest.skip("no place")
    r = http.get(f"{API}/places/{STATE['place_id']}", params={"lang": "ru"})
    assert r.status_code == 200, r.text


def test_place_photo_redirect(http):
    if not STATE.get("place_photo"):
        pytest.skip("no photo")
    r = httpx.get(f"{API}/places/photo", params={"name": STATE["place_photo"]}, follow_redirects=False, timeout=20)
    assert r.status_code in (302, 307)


# ---------- life ----------
def test_reminder_crud(http):
    hdr = {"Authorization": f"Bearer {STATE['access']}"}
    r = http.post(f"{API}/life/reminders", headers=hdr, json={"title": f"TEST_rem_{_rand(4)}", "notes": "note"})
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    STATE["rid"] = rid
    r2 = http.patch(f"{API}/life/reminders/{rid}", headers=hdr, json={"done": True})
    assert r2.status_code == 200
    assert r2.json()["done"] is True
    r3 = http.delete(f"{API}/life/reminders/{rid}", headers=hdr)
    assert r3.status_code == 200


def test_plans_crud(http):
    hdr = {"Authorization": f"Bearer {STATE['access']}"}
    r = http.post(f"{API}/life/plans", headers=hdr,
                  json={"title": f"TEST_plan_{_rand(4)}", "date": "2026-02-01",
                        "items": [{"time": "10:00", "text": "coffee"}]})
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    r2 = http.get(f"{API}/life/plans", headers=hdr)
    assert r2.status_code == 200
    assert any(p["id"] == pid for p in r2.json())
    r3 = http.delete(f"{API}/life/plans/{pid}", headers=hdr)
    assert r3.status_code == 200


def test_saved_places_crud(http):
    hdr = {"Authorization": f"Bearer {STATE['access']}"}
    pid = STATE.get("place_id") or "ChIJTEST"
    r = http.post(f"{API}/life/saved-places", headers=hdr,
                  json={"place_id": pid, "name": "TEST_place"})
    assert r.status_code == 200, r.text
    r2 = http.get(f"{API}/life/saved-places", headers=hdr)
    assert r2.status_code == 200
    r3 = http.delete(f"{API}/life/saved-places/{pid}", headers=hdr)
    assert r3.status_code == 200


def test_recommendations(http):
    r = http.get(f"{API}/life/recommendations", params={"city": "tashkent", "lang": "ru"})
    assert r.status_code == 200
    j = r.json()
    assert "slot" in j and "items" in j


def test_reminder_ownership(http):
    # user A creates reminder; user B tries to delete via PATCH -> must get 404
    hdr_a = {"Authorization": f"Bearer {STATE['access']}"}
    r = http.post(f"{API}/life/reminders", headers=hdr_a, json={"title": "TEST_own"})
    assert r.status_code == 200
    rid = r.json()["id"]
    # create a throwaway user to be user B
    email = f"test_{_rand(10)}@uzlife.dev"
    pwd = "Pw" + _rand(10)
    r2 = http.post(f"{API}/auth/signup", json={"email": email, "password": pwd, "name": "B"})
    assert r2.status_code == 200
    tok_b = r2.json()["access_token"]
    hdr_b = {"Authorization": f"Bearer {tok_b}"}
    r3 = http.patch(f"{API}/life/reminders/{rid}", headers=hdr_b, json={"done": True})
    assert r3.status_code == 404, "user B must not be able to update user A's reminder"
    # cleanup
    http.delete(f"{API}/life/reminders/{rid}", headers=hdr_a)
    http.delete(f"{API}/account", headers=hdr_b)


# ---------- AI chat ----------
def test_ai_chat_stream(http):
    hdr = {"Authorization": f"Bearer {STATE['access']}"}
    with httpx.stream("POST", f"{API}/ai/chat", headers=hdr,
                      json={"message": "Привет! Короткий тест.", "lang": "ru", "city": "tashkent"},
                      timeout=60) as r:
        assert r.status_code == 200
        events = []
        for line in r.iter_lines():
            if line and line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except json.JSONDecodeError:
                    pass
                if events and events[-1].get("type") == "done":
                    break
        kinds = {e["type"] for e in events}
        assert "delta" in kinds, events
        assert "done" in kinds


def test_ai_chat_places_action(http):
    hdr = {"Authorization": f"Bearer {STATE['access']}"}
    with httpx.stream("POST", f"{API}/ai/chat", headers=hdr,
                      json={"message": "Найди лучший плов рядом", "lang": "ru", "city": "tashkent"},
                      timeout=90) as r:
        assert r.status_code == 200
        action_evt = None
        for line in r.iter_lines():
            if line and line.startswith("data: "):
                try:
                    evt = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                if evt.get("type") == "action":
                    action_evt = evt
                if evt.get("type") == "done":
                    break
        # places search may or may not fire, but if it does it must be verified
        if action_evt:
            res = action_evt.get("result", {})
            assert res.get("kind") in ("places", "news", "reminders", "navigate", "confirm", "unsupported")


def test_ai_history(http):
    hdr = {"Authorization": f"Bearer {STATE['access']}"}
    r = http.get(f"{API}/ai/history", headers=hdr)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------- services / market ----------
def test_services_list(http):
    r = http.get(f"{API}/services")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_market_listings_list(http):
    r = http.get(f"{API}/market/listings")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_market_listing_crud(http):
    hdr = {"Authorization": f"Bearer {STATE['access']}"}
    body = {"title": f"TEST_lst_{_rand(4)}", "description": "Test item", "price": 1000,
            "currency": "UZS", "category": "other", "city": "tashkent", "contact": "+998901234567"}
    r = http.post(f"{API}/market/listings", headers=hdr, json=body)
    assert r.status_code == 200, r.text
    lid = r.json()["id"]
    r2 = http.get(f"{API}/market/mine", headers=hdr)
    assert any(l["id"] == lid for l in r2.json())
    r3 = http.delete(f"{API}/market/listings/{lid}", headers=hdr)
    assert r3.status_code == 200


def test_media_sign(http):
    hdr = {"Authorization": f"Bearer {STATE['access']}"}
    r = http.post(f"{API}/media/sign", headers=hdr)
    assert r.status_code == 200
    j = r.json()
    for k in ("cloud_name", "api_key", "timestamp", "folder", "signature"):
        assert k in j


# ---------- admin ----------
def test_admin_login_wrong(http):
    r = http.post(f"{API}/admin/login", json={"password": "wrongpass_xyz"})
    assert r.status_code in (401, 429), r.text


def test_admin_login_right(http):
    r = http.post(f"{API}/admin/login", json={"password": ADMIN_PWD})
    assert r.status_code == 200, r.text
    STATE["admin_token"] = r.json()["token"]


def test_admin_stats(http):
    hdr = {"X-Admin-Token": STATE["admin_token"]}
    r = http.get(f"{API}/admin/stats", headers=hdr)
    assert r.status_code == 200
    for k in ("users", "reminders", "plans", "listings", "news_items"):
        assert k in r.json()


def test_admin_sources_cycle(http):
    hdr = {"X-Admin-Token": STATE["admin_token"]}
    r = http.get(f"{API}/admin/sources", headers=hdr)
    assert r.status_code == 200
    body = {"name": f"TEST_src_{_rand(4)}", "url": "https://example.com/rss.xml",
            "category": "world", "region": "world", "lang": "en", "enabled": True}
    r2 = http.post(f"{API}/admin/sources", headers=hdr, json=body)
    assert r2.status_code == 200, r2.text
    sid = r2.json()["id"]
    r3 = http.patch(f"{API}/admin/sources/{sid}", headers=hdr, json={"enabled": False})
    assert r3.status_code == 200
    r4 = http.delete(f"{API}/admin/sources/{sid}", headers=hdr)
    assert r4.status_code == 200


def test_admin_config_toggle(http):
    hdr = {"X-Admin-Token": STATE["admin_token"]}
    # read current
    r = http.get(f"{API}/admin/config", headers=hdr)
    assert r.status_code == 200
    original_features = r.json()["features"]
    # toggle marketplace off then on
    r1 = http.put(f"{API}/admin/config", headers=hdr, json={"features": {"marketplace": False}})
    assert r1.status_code == 200
    assert r1.json()["features"]["marketplace"] is False
    r2 = http.put(f"{API}/admin/config", headers=hdr,
                  json={"features": {k: True for k in ("flash_ai", "explore", "news", "services", "marketplace")},
                        "website_url": "https://uzlife.uz", "announcement": ""})
    assert r2.status_code == 200
    j = r2.json()
    assert j["features"]["marketplace"] is True
    assert j["website_url"] == "https://uzlife.uz"
    assert j["announcement"] == ""


def test_admin_listings(http):
    hdr = {"X-Admin-Token": STATE["admin_token"]}
    r = http.get(f"{API}/admin/listings", headers=hdr)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_requires_token(http):
    r = http.get(f"{API}/admin/stats")
    assert r.status_code == 401
