-- Consent and unsubscribe for the waitlist.
--
-- Collecting an address and mailing it are different things. CAN-SPAM and
-- GDPR/PECR both require a working opt-out in every marketing message, so
-- until this exists the list can be gathered but not lawfully used.
--
-- `created_at` plus `source` already form the consent record: when they
-- signed up and which form they used. What was missing was the way out.

-- Null means subscribed. A timestamp is both the flag and the audit trail of
-- when they left, which a boolean would throw away.
alter table public.waitlist
  add column if not exists unsubscribed_at timestamptz;

-- Per-recipient secret so an unsubscribe link identifies the row without
-- putting the email address in a URL, where it would leak through referrers,
-- server logs, and shared links.
alter table public.waitlist
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists waitlist_unsubscribe_token_key
  on public.waitlist (unsubscribe_token);

-- Every send reads this, so it is worth an index rather than a seq scan.
create index if not exists waitlist_active_idx
  on public.waitlist (created_at)
  where unsubscribed_at is null;

-- A record of what actually went out. Without it there is no way to answer
-- "did we already send this?" — and a duplicate launch announcement to the
-- whole list is not a mistake you can take back.
create table if not exists public.waitlist_broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  recipients int not null default 0,
  failed int not null default 0,
  sent_at timestamptz not null default now()
);

alter table public.waitlist_broadcasts enable row level security;
-- No policies at all: this is service-role only. The browser has no business
-- reading send history, and the anon key must never see it.
