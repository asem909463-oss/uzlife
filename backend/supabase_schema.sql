-- Uzlife database schema. Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run (idempotent).
create extension if not exists pgcrypto;

-- ============ TABLES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  language text default 'ru',
  city text default 'tashkent',
  interests text[] default '{}',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  notes text,
  due_at timestamptz,
  done boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  date date,
  items jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  place_id text not null,
  name text,
  address text,
  rating numeric,
  photo text,
  lat double precision,
  lng double precision,
  category text,
  maps_uri text,
  created_at timestamptz default now(),
  unique (user_id, place_id)
);

create table if not exists public.news_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  article_id text not null,
  title text,
  url text,
  source text,
  image text,
  category text,
  published_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, article_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text,
  price numeric,
  currency text default 'UZS',
  category text,
  city text,
  contact text,
  image_url text,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  phone text,
  website text,
  city text,
  image_url text,
  active boolean default true,
  sort int default 0,
  created_at timestamptz default now()
);

create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  category text not null default 'world',
  region text not null default 'world',
  lang text default 'en',
  enabled boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.app_config (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  event text not null,
  user_id uuid,
  meta jsonb,
  created_at timestamptz default now()
);

create index if not exists reminders_user_idx on public.reminders(user_id, due_at);
create index if not exists plans_user_idx on public.plans(user_id, date);
create index if not exists chat_user_idx on public.chat_messages(user_id, created_at);
create index if not exists usage_created_idx on public.usage_events(created_at);
create index if not exists listings_created_idx on public.market_listings(created_at);

-- ============ AUTO PROFILE ON SIGNUP ============
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.reminders enable row level security;
alter table public.plans enable row level security;
alter table public.saved_places enable row level security;
alter table public.news_bookmarks enable row level security;
alter table public.chat_messages enable row level security;
alter table public.market_listings enable row level security;
alter table public.services enable row level security;
alter table public.news_sources enable row level security;
alter table public.app_config enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own reminders" on public.reminders;
create policy "own reminders" on public.reminders for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own plans" on public.plans;
create policy "own plans" on public.plans for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own saved places" on public.saved_places;
create policy "own saved places" on public.saved_places for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own bookmarks" on public.news_bookmarks;
create policy "own bookmarks" on public.news_bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own chat" on public.chat_messages;
create policy "own chat" on public.chat_messages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read active listings" on public.market_listings;
create policy "read active listings" on public.market_listings for select to anon, authenticated using (status = 'active' or user_id = auth.uid());
drop policy if exists "write own listings" on public.market_listings;
create policy "write own listings" on public.market_listings for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "update own listings" on public.market_listings;
create policy "update own listings" on public.market_listings for update to authenticated using (user_id = auth.uid());
drop policy if exists "delete own listings" on public.market_listings;
create policy "delete own listings" on public.market_listings for delete to authenticated using (user_id = auth.uid());

drop policy if exists "read active services" on public.services;
create policy "read active services" on public.services for select to anon, authenticated using (active);
drop policy if exists "read enabled sources" on public.news_sources;
create policy "read enabled sources" on public.news_sources for select to anon, authenticated using (enabled);
drop policy if exists "read config" on public.app_config;
create policy "read config" on public.app_config for select to anon, authenticated using (true);
-- usage_events: no policies => only the server (service_role) can read/write.

-- ============ SEED DATA ============
insert into public.app_config (key, value) values
  ('features', '{"flash_ai": true, "explore": true, "news": true, "services": true, "marketplace": true}'::jsonb),
  ('website_url', '"https://uzlife.uz"'::jsonb),
  ('announcement', '""'::jsonb)
on conflict (key) do nothing;

insert into public.news_sources (name, url, category, region, lang) values
  ('Gazeta.uz', 'https://www.gazeta.uz/ru/rss/', 'uzbekistan', 'uz', 'ru'),
  ('Kun.uz', 'https://kun.uz/news/rss', 'uzbekistan', 'uz', 'uz'),
  ('Daryo', 'https://daryo.uz/feed/', 'uzbekistan', 'uz', 'uz'),
  ('UzA', 'https://uza.uz/ru/rss', 'uzbekistan', 'uz', 'ru'),
  ('Spot.uz', 'https://www.spot.uz/ru/rss/', 'business', 'uz', 'ru'),
  ('BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'world', 'world', 'en'),
  ('BBC Русская служба', 'https://feeds.bbci.co.uk/russian/rss.xml', 'world', 'world', 'ru'),
  ('Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'world', 'world', 'en'),
  ('BBC Business', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'business', 'world', 'en'),
  ('TechCrunch', 'https://techcrunch.com/feed/', 'tech', 'world', 'en'),
  ('The Verge', 'https://www.theverge.com/rss/index.xml', 'tech', 'world', 'en'),
  ('Хабр', 'https://habr.com/ru/rss/news/', 'tech', 'world', 'ru'),
  ('BBC Sport', 'https://feeds.bbci.co.uk/sport/rss.xml', 'sports', 'world', 'en'),
  ('Чемпионат', 'https://www.championat.com/rss/news/', 'sports', 'world', 'ru')
on conflict (url) do nothing;

insert into public.services (name, category, description, phone, website, sort)
select * from (values
  ('Скорая помощь', 'emergency', 'Экстренная медицинская помощь', '103', null, 1),
  ('Полиция', 'emergency', 'Экстренный вызов полиции', '102', null, 2),
  ('Пожарная служба / МЧС', 'emergency', 'Пожарная охрана и спасатели', '101', null, 3),
  ('Аварийная газовая служба', 'emergency', 'Утечка газа', '104', null, 4),
  ('my.gov.uz', 'government', 'Единый портал интерактивных госуслуг', null, 'https://my.gov.uz', 5),
  ('Yandex Go', 'transport', 'Такси, доставка и самокаты', null, 'https://go.yandex', 6),
  ('Uzum Market', 'shopping', 'Онлайн-маркетплейс', null, 'https://uzum.uz', 7),
  ('OLX.uz', 'shopping', 'Объявления: товары, работа, недвижимость', null, 'https://www.olx.uz', 8)
) as v(name, category, description, phone, website, sort)
where not exists (select 1 from public.services);
