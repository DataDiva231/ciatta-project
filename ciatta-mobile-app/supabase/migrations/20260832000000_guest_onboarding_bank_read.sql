-- Guest onboarding needs the onboarding rows from curiosity_bank so it can
-- run next_onboarding_question()'s branching locally without inserting
-- curiosities (or any other account-scoped rows) before authentication.
-- Daily-rotation rows stay hidden: the policy is onboarding + active only.

grant select on public.curiosity_bank to anon, authenticated;

create policy curiosity_bank_onboarding_read
  on public.curiosity_bank
  for select
  to anon, authenticated
  using (is_onboarding and active);
