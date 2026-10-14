# Uzlife — PRD

## Original problem statement
Premium AI-powered super-app for people in Uzbekistan: discovering places, services, news, daily tasks, AI. Russian default (+Uzbek, English). Sections: Flash AI (Gemini, control panel, actions with confirmation), Explore (Google Places), News (RSS, categories, search, bookmarks, AI summaries/translation), My Life, Services & Marketplace, Accounts, Admin dashboard (secure login, news sources, feature toggles, usage, remote website URL). Supabase, Cloudinary, Gemini, Google Places. Admin password stored securely.

## User choices
- Gemini 3 Flash via Emergent Universal Key
- Email/password + guest only
- Data in user's Supabase (service role server-side); schema in /app/backend/supabase_schema.sql (user ran it)
- Admin hidden inside app (Profile → tap version 5×)
- Dark premium navy/amber glass design (Playfair Display + Manrope)

## Architecture
- Expo Router app (tabs: Home, Explore, News, Life; stack: flash, place/[id], article/[id], services, places, market/*, profile, admin, life-new, auth). NativeTabs on iOS 26+.
- FastAPI modular backend: core/{sb,deps,llm}, routers/{auth,news,places,life,market,ai,admin}. All keys in backend/.env.
- Supabase: profiles, reminders, plans, saved_places, news_bookmarks, chat_messages, market_listings, services, news_sources, app_config, usage_events — RLS enabled.
- News refreshed every 10 min from 14 RSS feeds (in-memory cache); AI summary/translate cached.
- Flash AI: SSE streaming; read actions run server-side (verified), write actions show confirm card.
- Admin: PBKDF2 hash in env, JWT session (8h), rate-limit 5/15min.

## Implemented (2026-10-14)
- All sections above, end-to-end tested (36/36 backend tests, frontend flows pass).

## Known issues / needs from user
- Cloudinary API secret invalid → listing photo upload fails (listings without photo work).
- Supabase email confirmation bypassed via admin API (users auto-confirmed).

## Backlog
- P1: Correct Cloudinary secret; avatar upload; local reminder notifications
- P1: Map view in Explore (react-native-maps)
- P2: Marketplace chat/messages, service bookings, featured/paid listings
- P2: Admin services CRUD UI (API exists), usage charts per feature
