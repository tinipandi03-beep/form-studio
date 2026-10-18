create extension if not exists pgcrypto;

create table if not exists public.admin_account (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.visitors (
  visitor_id uuid primary key,
  last_seen timestamptz not null default now()
);

create table if not exists public.visitor_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  page text not null check (
    page in (
      'home', 'services', 'portfolio',
      'process', 'pricing', 'contact'
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists visitor_events_created_idx
on public.visitor_events (created_at desc);

create index if not exists visitor_events_page_idx
on public.visitor_events (page, created_at desc);

alter table public.admin_account enable row level security;
alter table public.visitors enable row level security;
alter table public.visitor_events enable row level security;

-- Tidak membuat policy publik.
-- Akses database dilakukan oleh backend menggunakan service-role key.
