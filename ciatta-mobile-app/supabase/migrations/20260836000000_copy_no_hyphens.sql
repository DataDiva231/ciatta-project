-- Strip hyphens from live curiosity chip copy. Tags and branching stay the same.

update public.curiosity_bank
set answer_options = array['Rarely', '1 or 2 nights', '3 or 4 nights', 'Most nights']
where tag = 'concern_sleep_followup';

update public.curiosities
set answer_options = array['Rarely', '1 or 2 nights', '3 or 4 nights', 'Most nights']
where '1-2 nights' = any(answer_options)
   or '3-4 nights' = any(answer_options);
