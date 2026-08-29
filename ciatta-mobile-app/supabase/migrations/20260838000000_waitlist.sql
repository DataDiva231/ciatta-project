-- Waitlist signups from the marketing site.
--
-- The landing page runs in a browser with the publishable key, so RLS is the
-- only thing standing between this table and the open internet. The policy set
-- below is deliberately lopsided: anon may INSERT and may do nothing else.
-- There is no SELECT policy, so the list cannot be enumerated by the same key
-- that writes to it — a signup form must never double as an email scraper.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness: Person@x.com and person@x.com are one person.
-- The client relies on the resulting 23505 to say "you're already on the list"
-- instead of reporting a failure.
create unique index if not exists waitlist_email_key
  on public.waitlist (lower(email));

-- Cheap guard against obvious junk. Not a validity check — no regex proves an
-- address deliverable — just enough to reject empty and malformed input that
-- never reached the browser's own validation.
alter table public.waitlist
  drop constraint if exists waitlist_email_shape;
alter table public.waitlist
  add constraint waitlist_email_shape
  check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

alter table public.waitlist enable row level security;

drop policy if exists "anon can join the waitlist" on public.waitlist;
create policy "anon can join the waitlist"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

-- Deliberately absent: any select/update/delete policy. Read the list from the
-- dashboard or with the service role, never from the client.
