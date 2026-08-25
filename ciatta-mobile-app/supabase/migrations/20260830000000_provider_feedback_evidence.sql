-- Closes the one provenance gap the earlier architecture audit identified:
-- `evidence` has never had a column distinguishing what produced it, unlike
-- `understandings.evidence_type` (added earlier this build for exactly the
-- same reason — see 20260828000000_contextual_understanding.sql). Needed
-- now because Provider Feedback becomes a real Evidence row for the first
-- time (see processProviderFeedbackEvidence() in the Understanding
-- Engine), and it must be distinguishable from the physiological Evidence
-- every domain processor already writes — 'health_data' as the default
-- keeps every existing row's meaning exactly what it already was.
alter table public.evidence
  add column evidence_type text not null default 'health_data';
