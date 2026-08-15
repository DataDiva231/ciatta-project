-- Push tokens for delivering discoveries. One row per device per user, so a
-- user with a phone and a tablet gets both.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens: read own" on public.push_tokens
  for select using (auth.uid() = user_id);
create policy "push_tokens: insert own" on public.push_tokens
  for insert with check (auth.uid() = user_id);
create policy "push_tokens: update own" on public.push_tokens
  for update using (auth.uid() = user_id);
create policy "push_tokens: delete own" on public.push_tokens
  for delete using (auth.uid() = user_id);

-- Marks which discoveries have already been announced, so the notifier never
-- tells someone about the same discovery twice.
alter table public.discoveries
  add column if not exists notified_at timestamptz;
