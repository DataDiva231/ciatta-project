-- Cross-Domain Understanding — the one new table this feature needs.
--
-- Deliberately shaped like `relationships`, not like a generalized N-ary
-- fusion table: v1 cross-domain synthesis only ever promotes an existing,
-- already-qualifying `relationships` row (from_domain, to_domain) into a
-- higher-level Understanding once both sides independently clear the same
-- bar Guidance already requires. That is the smallest persistence
-- structure that can hold this without inventing a new taxonomy or a new
-- confidence mechanism — see the Understanding Engine's own
-- crossDomainSynthesis.ts for the gate this table's rows must have already
-- passed before they exist at all.
--
-- Not a replacement for `understandings`: a physiological/domain-level
-- Understanding is unaffected by anything in this table, and nothing here
-- is read by the four physiological processors or by
-- processContextualDomain(). This table is purely additive, read by one
-- new synthesis step and (like `understandings`) by Guidance/Care
-- Connection once a row exists.
create table public.cross_domain_understandings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Same pair the qualifying `relationships` row already names — this is
  -- provenance, not a new domain taxonomy. See label below for the
  -- higher-level health-area vocabulary the task asked for.
  from_domain domain_type not null,
  to_domain domain_type not null,

  -- The higher-level health-area label (e.g. 'recovery-related',
  -- 'cycle-related') — a small, closed-form vocabulary distinct from
  -- domain_type by design (see the architecture audit this migration
  -- follows: broader health concepts live at the Understanding level, not
  -- folded into the five signal domains). Never user-facing free text,
  -- never written from anything but the synthesis step's own enumerated
  -- map.
  label text not null,

  narrative text not null default '',
  strength strength_type not null default 'emerging',
  confidence_label text,

  -- Always exactly the two contributing Understandings' ids (from_domain's
  -- and to_domain's) — kept as an array, not two named columns, so the
  -- shape matches `discoveries.understanding_ids` and any future N-ary
  -- extension doesn't require a schema change here.
  contributing_understanding_ids uuid[] not null default '{}',

  still_learning text[] not null default '{}',

  -- Same three fields, same meaning, same downstream consumer (Care
  -- Connection / Provider Search) as understandings.guidance /
  -- care_recommendation_type / care_recommendation_reason — deriveGuidance()
  -- itself is unchanged and untouched by this migration.
  guidance text,
  care_recommendation_type text,
  care_recommendation_reason text,

  -- Always 'health_data' today (both contributing Understandings are
  -- required to be health_data-grounded before synthesis runs at all —
  -- see the gate in crossDomainSynthesis.ts) — present for the same reason
  -- understandings.evidence_type is: so a future, genuinely different
  -- provenance never needs a schema change to be expressed.
  evidence_type text not null default 'health_data',

  first_observed date,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (user_id, from_domain, to_domain)
);

alter table public.cross_domain_understandings enable row level security;

create policy "cross_domain_understandings: read own" on public.cross_domain_understandings
  for select using (auth.uid() = user_id);
