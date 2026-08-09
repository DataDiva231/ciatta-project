-- Onboarding step 6 already asks which health categories a user is willing
-- to share (cycle/medical/meds checkboxes) and collects the answer client-
-- side, but nothing ever persisted it — the You screen's "shared" status
-- was permanently hardcoded to "Not shared yet" regardless of what the
-- user actually chose.
alter table public.profiles add column shared_health_rows text[] not null default '{}';
