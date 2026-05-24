-- CAT Catalyst sync schema.
-- Run this in the Supabase SQL editor after creating a project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'CAT User',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark',
  active_local_profile text not null default 'User',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  bank_version text,
  section text not null check (section in ('varc', 'qa')),
  passage_title text,
  passage_text text,
  question jsonb not null,
  client_op_id text,
  bookmarked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, question_id)
);

create table if not exists public.attempts (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id text not null,
  test_type text not null,
  paper_id text,
  seed text,
  blueprint_id text,
  bank_version text,
  score integer not null default 0,
  max_score integer not null default 0,
  correct integer not null default 0,
  wrong integer not null default 0,
  skipped integer not null default 0,
  time_used integer not null default 0,
  source_mix jsonb not null default '{}'::jsonb,
  type_mix jsonb not null default '{}'::jsonb,
  client_op_id text,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.attempt_answers (
  attempt_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  question_index integer not null,
  section text,
  answer text,
  outcome text not null check (outcome in ('correct', 'wrong', 'skipped')),
  marked boolean not null default false,
  time_sec integer not null default 0,
  changes integer not null default 0,
  question jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, attempt_id, question_id),
  foreign key (user_id, attempt_id) references public.attempts(user_id, id) on delete cascade
);

create table if not exists public.completed_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null,
  section_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, day_key, section_id)
);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.bookmarks enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.completed_days enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "settings_all_own" on public.user_settings;
create policy "settings_all_own"
on public.user_settings for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "bookmarks_all_own" on public.bookmarks;
create policy "bookmarks_all_own"
on public.bookmarks for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "attempts_all_own" on public.attempts;
create policy "attempts_all_own"
on public.attempts for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "attempt_answers_all_own" on public.attempt_answers;
create policy "attempt_answers_all_own"
on public.attempt_answers for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "completed_days_all_own" on public.completed_days;
create policy "completed_days_all_own"
on public.completed_days for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch_updated_at on public.user_settings;
create trigger settings_touch_updated_at
before update on public.user_settings
for each row execute function public.touch_updated_at();

drop trigger if exists bookmarks_touch_updated_at on public.bookmarks;
create trigger bookmarks_touch_updated_at
before update on public.bookmarks
for each row execute function public.touch_updated_at();
