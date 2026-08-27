-- Remove any remaining em dashes from live curiosity copy.
-- Questions and purposes only. Branching tags stay the same.

update public.curiosity_bank
set
  question = replace(replace(question, ' — ', '. '), '—', '. '),
  purpose = replace(replace(purpose, ' — ', '. '), '—', '. ')
where question like '%—%'
   or purpose like '%—%';

update public.curiosities
set
  question = replace(replace(question, ' — ', '. '), '—', '. '),
  purpose = replace(replace(purpose, ' — ', '. '), '—', '. ')
where question like '%—%'
   or purpose like '%—%';
