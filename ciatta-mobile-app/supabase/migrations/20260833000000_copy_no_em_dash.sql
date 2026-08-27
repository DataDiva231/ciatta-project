-- Replace em dashes in onboarding copy the conversation actually shows.
update public.curiosity_bank
set purpose = 'Some medications change how your body responds. This helps me tell a pattern from a side effect.'
where tag = 'medications'
  and purpose like '%—%';

update public.curiosity_bank
set purpose = 'There''s no category to pick from. Just tell me what''s on your mind, in your own words.'
where tag = 'concern'
  and purpose like '%—%';
