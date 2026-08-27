-- User-centric voice: curiosity bank copy speaks about the user, not Ciatta.
-- Questions and purposes only. Branching tags and observation types stay the same.

update public.curiosity_bank
set purpose = 'This helps show how your energy moves through your cycle.'
where observation_type = 'energy_rating'
  and purpose like '%helps me%';

update public.curiosity_bank
set purpose = 'This helps show patterns in how you''re feeling.'
where observation_type = 'mood_rating'
  and purpose like '%helps me%';

update public.curiosity_bank
set purpose = 'This helps complete the picture of your sleep today.'
where observation_type = 'sleep_interruption'
  and purpose like '%helps me%';

update public.curiosity_bank
set
  question = 'What brings you here?',
  purpose = 'This helps show what to focus on first.'
where tag = 'intent';

update public.curiosity_bank
set
  question = 'What''s on your mind about your body?',
  purpose = 'There''s no category to pick from. Just share what''s on your mind, in your own words.'
where tag = 'concern';

update public.curiosity_bank
set purpose = 'Some medications change how your body responds. This helps tell a pattern from a side effect.'
where tag = 'medications';

update public.curiosity_bank
set
  question = 'Is there any health history or condition that belongs here?',
  purpose = 'This gives context so a known condition isn''t mistaken for a new pattern.'
where tag = 'health_history';

update public.curiosity_bank
set purpose = 'This helps show what typical looks like for you specifically.'
where tag = 'concern_cycle_followup';

update public.curiosity_bank
set purpose = 'This helps show how much sleep is actually costing you.'
where tag = 'concern_sleep_followup';

update public.curiosity_bank
set purpose = 'This helps look for a rhythm rather than treating every low day the same.'
where tag = 'concern_energy_followup';

update public.curiosity_bank
set purpose = 'This helps show whether to look for a cyclical pattern.'
where tag = 'concern_mood_followup';

update public.curiosity_bank
set purpose = 'This helps pay attention to recovery specifically, not just activity.'
where tag = 'concern_recovery_followup';

update public.curiosity_bank
set
  question = 'A little more, in your own words. What''s changed?',
  purpose = 'Your own words say more than a category ever could.'
where tag = 'concern_elaborate';

update public.curiosity_bank
set purpose = 'This helps tell a new pattern from a long-standing one.'
where tag = 'concern_recency';
