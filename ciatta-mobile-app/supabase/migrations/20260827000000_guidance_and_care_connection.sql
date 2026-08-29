-- Extends the existing Understanding layer with Guidance and Care
-- Connection, per the pipeline:
--   Source -> Observation -> Evidence -> Understanding -> Guidance ->
--   Care Connection / Decision Support -> Memory -> Narrative
--
-- Both are additive columns on the SAME `understandings` row they're
-- derived from, not a parallel table or a parallel engine: whatever
-- confidence/evidence already justified the Understanding is the exact
-- same confidence/evidence Guidance is gated on, computed at the same
-- point in the same nightly Understanding Engine run (see
-- understanding-engine/careGuidance.ts and its one call site in
-- upsertUnderstanding()). A row with no Guidance simply has these three
-- columns null — that IS the "remain silent when evidence does not
-- justify guidance" behavior, not a special case to branch on.

alter table public.understandings add column guidance text;
alter table public.understandings add column care_recommendation_type text;
alter table public.understandings add column care_recommendation_reason text;

-- Provider Feedback: a patient-mediated report of what a provider said or
-- determined, entered the same way a manual note already is (through
-- insertObservation), but tagged with its own provenance rather than
-- folded into 'manual' — the whole point of the Guidance Safety section is
-- keeping "what the user reported" and "what a provider determined"
-- distinguishable downstream, and the `source` column is where this
-- codebase already draws that line for every other origin (device sync,
-- curiosity answers, manual notes).
alter type observation_source add value 'provider';
