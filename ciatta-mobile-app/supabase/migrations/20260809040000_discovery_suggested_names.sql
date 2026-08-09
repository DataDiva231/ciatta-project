-- The naming flow ("What would you call this?") needs candidate names to
-- offer alongside the free-text option. Generated server-side by whichever
-- rule produced the Discovery, same as everything else here — the client
-- only ever displays and picks.
alter table public.discoveries add column suggested_names text[] not null default '{}';
