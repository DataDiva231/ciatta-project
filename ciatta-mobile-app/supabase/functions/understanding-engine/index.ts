// Understanding Engine — computes real Understandings from Observations.
// Runs server-side only, using the service_role key (bypasses RLS by
// design — see the comment at the top of the init migration). Never called
// from the mobile client.
//
// Invoked as a hybrid:
//   - nightly (default, body `{}`) by pg_cron — full reconciliation, decay,
//     cross-domain synthesis, then a lightweight morning-state bump
//   - continuous (`{"mode":"continuous"}`) — only the processors implied by
//     newly arrived observations, after debounce/batching
//   - morning (`{"mode":"morning"}`) — sleep processor + morning-state only
//   - or for a single user via `{"user_id":"..."}`
//
// Cadence and processor selection live in continuousIntelligence.ts; this
// file still owns every write. Processors and schemas are unchanged.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  detectCycles,
  analyzeCycles,
  buildUnderstanding,
  strengthForConfidence,
  type FlowObservation,
  type RhrObservation,
  type Strength,
} from './cycleAnalysis.ts';
import {
  analyzeCycleRatingRelationship,
  buildRelationship,
  buildCycleDiscovery,
  type EnergyObservation,
  type RatingObservation,
} from './energyRelationship.ts';
import {
  analyzeSleep,
  buildSleepUnderstanding,
  analyzeSleepRatingRelationship,
  buildSleepRatingDiscovery,
  type SleepObservation,
} from './sleepAnalysis.ts';
import {
  analyzeSteps,
  buildStepsUnderstanding,
  analyzeStepsRatingRelationship,
  buildStepsRatingDiscovery,
  type StepsObservation,
} from './stepsAnalysis.ts';
import {
  analyzeHrv,
  buildHrvUnderstanding,
  analyzeHrvRatingRelationship,
  buildHrvRatingDiscovery,
  latestDayIsLowVsPersonalBaseline,
  type HrvObservation,
} from './hrvAnalysis.ts';
import { analyzeMood, buildMoodUnderstanding } from './moodAnalysis.ts';
import { deriveGuidance } from './careGuidance.ts';
import { buildContextualUnderstanding, mapConcernToDomain, type Domain } from './contextualUnderstanding.ts';
import { nextDecayedState } from './decay.ts';
import { buildCrossDomainDraft } from './crossDomainSynthesis.ts';
import {
  selectNewProviderFeedbackDrafts,
  type ProviderFeedbackObservation,
} from './providerFeedbackEvidence.ts';
import {
  isMeaningfulChange,
  isRedundantUnderstandingWrite,
  planForMode,
  processorsForObservationTypes,
  runFingerprint,
  decideContinuousDrain,
  retryNotBeforeMs,
  type ProcessorName,
} from './continuousIntelligence.ts';
import { selectMorningDomain, type MorningWrite } from './morningState.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ObservationRow {
  id: string;
  type: string;
  recorded_at: string;
  value: Record<string, unknown>;
  context: Record<string, unknown>;
}

// The onboarding conversation's own answer, kept as-typed — this module
// never re-derives or paraphrases it, only reads it back.
interface ContextualObservation {
  id: string;
  recordedAt: string;
  answer: string;
  // health_concern's own context.health_domains, written at answer time by
  // the client's classifyHealthIntent() (src/lib/healthIntent.ts) — reused
  // here rather than re-classifying the same text a second time.
  healthDomains: string[];
}

interface LoadedObservations {
  flow: FlowObservation[];
  rhr: RhrObservation[];
  energy: EnergyObservation[];
  mood: RatingObservation[];
  sleep: SleepObservation[];
  steps: StepsObservation[];
  hrv: HrvObservation[];
  concern: ContextualObservation | null;
  concernElaboration: ContextualObservation | null;
  concernRecency: ContextualObservation | null;
  providerFeedback: ProviderFeedbackObservation[];
}

async function loadObservations(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<LoadedObservations> {
  const { data, error } = await supabase
    .from('observations')
    .select('id, type, recorded_at, value, context')
    .eq('user_id', userId)
    .in('type', [
      'resting_heart_rate',
      'menstrual_flow',
      'energy_rating',
      'mood_rating',
      'sleep_session',
      'sleep_segment',
      'steps',
      'hrv',
      'health_concern',
      'health_concern_detail',
      'health_concern_recency',
      'provider_assessment',
      'provider_outcome',
    ])
    .order('recorded_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as ObservationRow[];
  const flow: FlowObservation[] = [];
  const rhr: RhrObservation[] = [];
  const energy: EnergyObservation[] = [];
  const mood: RatingObservation[] = [];
  const sleep: SleepObservation[] = [];
  const steps: StepsObservation[] = [];
  const hrv: HrvObservation[] = [];
  // Rows are loaded oldest-first, so simply overwriting on each match
  // leaves the most recent answer for each — onboarding asks each of
  // these at most once per user today, but this stays correct even if
  // that ever changes.
  let concern: ContextualObservation | null = null;
  let concernElaboration: ContextualObservation | null = null;
  let concernRecency: ContextualObservation | null = null;
  const providerFeedback: ProviderFeedbackObservation[] = [];

  for (const row of rows) {
    if (row.type === 'menstrual_flow') {
      flow.push({
        id: row.id,
        recordedAt: row.recorded_at,
        cycleStart: (row.context?.cycleStart as boolean | null) ?? null,
      });
    } else if (row.type === 'resting_heart_rate') {
      const bpm = row.value?.bpm;
      if (typeof bpm === 'number') {
        rhr.push({ id: row.id, recordedAt: row.recorded_at, bpm });
      }
    } else if (row.type === 'energy_rating') {
      const rating = row.value?.rating;
      if (typeof rating === 'number') {
        energy.push({ id: row.id, recordedAt: row.recorded_at, rating });
      }
    } else if (row.type === 'mood_rating') {
      const rating = row.value?.rating;
      if (typeof rating === 'number') {
        mood.push({ id: row.id, recordedAt: row.recorded_at, rating });
      }
    } else if (row.type === 'sleep_session' || row.type === 'sleep_segment') {
      const durationMinutes = row.value?.durationMinutes;
      const startTime = row.context?.startTime;
      if (typeof durationMinutes === 'number' && typeof startTime === 'string') {
        sleep.push({
          id: row.id,
          type: row.type,
          startTime,
          endTime: row.recorded_at,
          durationMinutes,
          stage: (row.value?.stage as string | undefined) ?? null,
        });
      }
    } else if (row.type === 'steps') {
      const count = row.value?.count;
      if (typeof count === 'number') {
        steps.push({ id: row.id, recordedAt: row.recorded_at, count });
      }
    } else if (row.type === 'hrv') {
      const ms = row.value?.ms;
      if (typeof ms === 'number') {
        // SDNN (HealthKit) and RMSSD (Health Connect) are both real HRV
        // metrics, computed differently — see hrvAnalysis.ts's own
        // filterToConsistentMetric(), the one place this actually matters.
        const metric = row.context?.metric;
        hrv.push({
          id: row.id,
          recordedAt: row.recorded_at,
          ms,
          metric: typeof metric === 'string' ? metric : null,
        });
      }
    } else if (row.type === 'health_concern') {
      const answer = row.value?.answer;
      if (typeof answer === 'string') {
        const domains = row.context?.health_domains;
        concern = {
          id: row.id,
          recordedAt: row.recorded_at,
          answer,
          healthDomains: Array.isArray(domains) ? (domains as string[]) : [],
        };
      }
    } else if (row.type === 'health_concern_detail') {
      const answer = row.value?.answer;
      if (typeof answer === 'string') {
        // The elaboration is classified too (ConversationOnboarding.tsx
        // runs classifyHealthIntent() on both 'concern' and
        // 'concern_elaborate' answers) and is free text, so it's often the
        // more specific signal of the two — e.g. a generic "I'm trying to
        // improve something" chip followed by a free-text elaboration that
        // actually names sleep.
        const domains = row.context?.health_domains;
        concernElaboration = {
          id: row.id,
          recordedAt: row.recorded_at,
          answer,
          healthDomains: Array.isArray(domains) ? (domains as string[]) : [],
        };
      }
    } else if (row.type === 'health_concern_recency') {
      const answer = row.value?.answer;
      if (typeof answer === 'string') {
        concernRecency = { id: row.id, recordedAt: row.recorded_at, answer, healthDomains: [] };
      }
    } else if (row.type === 'provider_assessment' || row.type === 'provider_outcome') {
      // Both written client-side with the same context shape (see
      // UnderstandingSheet.tsx's handleSaveProviderNote) — domain and
      // understandingId name what this feedback is about; ownership of
      // that understandingId is verified separately, server-side, in
      // processProviderFeedbackEvidence() before anything is written from
      // it, since this context is client-supplied JSON on the client's own
      // observation row, not something RLS validates the *contents* of.
      const domain = row.context?.domain;
      const understandingId = row.context?.understandingId;
      providerFeedback.push({
        id: row.id,
        type: row.type,
        recordedAt: row.recorded_at,
        domain: typeof domain === 'string' ? (domain as Domain) : null,
        understandingId: typeof understandingId === 'string' ? understandingId : null,
      });
    }
  }

  return {
    flow,
    rhr,
    energy,
    mood,
    sleep,
    steps,
    hrv,
    concern,
    concernElaboration,
    concernRecency,
    providerFeedback,
  };
}

interface UnderstandingDraftLike {
  strength: Strength;
  narrative: string;
  confidenceLabel: string;
  stillLearning?: string[];
}

/** Writes Evidence + upserts the Understanding + logs history on change.
 *
 * `evidenceType` is always passed explicitly by every caller, never
 * defaulted here — the four physiological domain processors pass
 * 'health_data', processContextualDomain() passes 'user_reported'. It has
 * to be explicit on every call because it's part of the upsert payload:
 * leaving it out wouldn't fall back to the column's DB default on an
 * UPDATE (only on a fresh INSERT), so an omitted value on a second write
 * would silently leave a row's evidence_type stuck at whatever it was
 * before — exactly backwards for a physiological write that's meant to
 * upgrade a domain from 'user_reported' once real data arrives. */
async function upsertUnderstanding(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  domain: string,
  draft: UnderstandingDraftLike,
  observationIds: string[],
  weight: number,
  confidence: number,
  firstObserved: string | null,
  historyLabel: { first: string; changed: string },
  evidenceType: 'health_data' | 'user_reported',
  skipIfUnchanged = false
): Promise<string> {
  const { data: existing, error: fetchError } = await supabase
    .from('understandings')
    .select('id, strength, learning_since, narrative, confidence_label, observations_count, still_learning')
    .eq('user_id', userId)
    .eq('domain', domain)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (
    skipIfUnchanged &&
    existing &&
    isRedundantUnderstandingWrite(
      {
        strength: existing.strength as string,
        narrative: (existing.narrative as string) ?? '',
        confidenceLabel: (existing.confidence_label as string) ?? '',
        observationsCount: (existing.observations_count as number) ?? 0,
        stillLearning: (existing.still_learning as string[]) ?? [],
      },
      {
        strength: draft.strength,
        narrative: draft.narrative,
        confidenceLabel: draft.confidenceLabel,
        observationsCount: observationIds.length,
        stillLearning: draft.stillLearning ?? [],
      }
    )
  ) {
    return existing.id as string;
  }

  const { error: evidenceError } = await supabase.from('evidence').insert({
    user_id: userId,
    domain,
    observation_ids: observationIds.slice(-500),
    weight,
    confidence,
  });
  if (evidenceError) throw evidenceError;

  // The strongest Relationship this domain already has in the model, if
  // any — read before Guidance is derived so Guidance can name a real,
  // already-represented connection instead of reading as generic advice.
  // Relationships are only ever written from processing that already ran
  // (this call happens before this run's own relationship step), so on a
  // brand-new domain this is simply empty — never a reason to invent one.
  const { data: relatedRows, error: relatedError } = await supabase
    .from('relationships')
    .select('from_domain, to_domain, confidence')
    .or(`from_domain.eq.${domain},to_domain.eq.${domain}`)
    .order('confidence', { ascending: false })
    .limit(1);
  if (relatedError) throw relatedError;
  const connectedDomain = relatedRows?.[0]
    ? relatedRows[0].from_domain === domain
      ? (relatedRows[0].to_domain as string)
      : (relatedRows[0].from_domain as string)
    : null;

  // Same anchor upsertUnderstanding's own `learning_since` write below
  // uses: the persisted value once one exists, else this run's own
  // firstObserved for a brand-new row — evidenceSentence() only ever needs
  // one date, not both fields separately.
  const learningSinceAnchor = (existing as { learning_since?: string | null } | null)?.learning_since ?? firstObserved;

  const { guidance, careRecommendationType, careRecommendationReason } = deriveGuidance(
    domain,
    draft.strength,
    connectedDomain,
    { observationsCount: observationIds.length, learningSince: learningSinceAnchor }
  );

  const { data: upserted, error: upsertError } = await supabase
    .from('understandings')
    .upsert(
      {
        user_id: userId,
        domain,
        strength: draft.strength,
        narrative: draft.narrative,
        confidence_label: draft.confidenceLabel,
        observations_count: observationIds.length,
        first_observed: firstObserved,
        learning_since: existing?.strength == null ? firstObserved : undefined,
        last_updated: new Date().toISOString(),
        still_learning: draft.stillLearning ?? [],
        guidance,
        care_recommendation_type: careRecommendationType,
        care_recommendation_reason: careRecommendationReason,
        evidence_type: evidenceType,
      },
      { onConflict: 'user_id,domain' }
    )
    .select('id')
    .single();
  if (upsertError) throw upsertError;

  if (!existing || existing.strength !== draft.strength) {
    const label = existing ? historyLabel.changed : historyLabel.first;
    const { error: historyError } = await supabase.from('understanding_history').insert({
      understanding_id: upserted.id,
      user_id: userId,
      event_date: new Date().toISOString().slice(0, 10),
      label,
    });
    if (historyError) throw historyError;
  }

  return upserted.id;
}

interface DiscoveryDraftLike {
  narrative: string;
  detail: string;
  confidence: number;
  confidenceLabel: string;
  suggestedNames: string[];
}

/** Upserts the Relationship and, once strongly corroborated, mints a
 * Discovery exactly once. Dedup checks both understanding_ids AND the exact
 * narrative — one Understanding can feed multiple distinct Relationships
 * (e.g. sleep -> energy and sleep -> mood both stem from the 'sleep'
 * Understanding), so understanding_ids alone would let the first
 * Discovery's presence silently block every other real one from the same
 * source. */
async function upsertRelationshipAndDiscovery(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fromDomain: string,
  toDomain: string,
  understandingId: string,
  strength: Strength | null,
  confidence: number,
  discoveryDraft: DiscoveryDraftLike | null
): Promise<{ relationshipWritten: boolean; discoveryWritten: boolean }> {
  if (!strength) return { relationshipWritten: false, discoveryWritten: false };

  const { error: relError } = await supabase.from('relationships').upsert(
    {
      user_id: userId,
      from_domain: fromDomain,
      to_domain: toDomain,
      strength,
      confidence,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,from_domain,to_domain' }
  );
  if (relError) throw relError;

  if (!discoveryDraft) return { relationshipWritten: true, discoveryWritten: false };

  const { data: existingDiscovery, error: discoveryFetchError } = await supabase
    .from('discoveries')
    .select('id')
    .eq('user_id', userId)
    .eq('narrative', discoveryDraft.narrative)
    .contains('understanding_ids', [understandingId])
    .maybeSingle();
  if (discoveryFetchError) throw discoveryFetchError;

  if (existingDiscovery) return { relationshipWritten: true, discoveryWritten: false };

  const { error: discoveryError } = await supabase.from('discoveries').insert({
    user_id: userId,
    narrative: discoveryDraft.narrative,
    detail: discoveryDraft.detail,
    confidence: discoveryDraft.confidence,
    confidence_label: discoveryDraft.confidenceLabel,
    suggested_names: discoveryDraft.suggestedNames,
    understanding_ids: [understandingId],
    status: 'pending',
  });
  if (discoveryError) throw discoveryError;

  return { relationshipWritten: true, discoveryWritten: true };
}

async function processCycleDomain(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  obs: LoadedObservations,
  skipIfUnchanged = false
) {
  const cycles = detectCycles(obs.flow);
  const result = analyzeCycles(cycles, obs.rhr);
  const draft = buildUnderstanding(result);
  if (!draft) return { wrote: false, reason: !result ? 'no-data' : 'not-eligible' };

  const understandingId = await upsertUnderstanding(
    supabase,
    userId,
    'cycle',
    draft,
    result.observationIds,
    result.cyclesWithSufficientData,
    result.confidence,
    result.firstCycleStart ? result.firstCycleStart.toISOString().slice(0, 10) : null,
    {
      first: 'A possible heart rate pattern tied to your cycle started to show.',
      changed: `This pattern has held for ${result.cyclesWithSufficientData} cycles now.`,
    },
    'health_data',
    skipIfUnchanged
  );

  // Same rationale as the sleep domain: energy and mood are collected
  // identically, so both get their own independent Relationship test
  // rather than being conflated into one.
  const ratingSources: { toDomain: 'energy' | 'mood'; observations: RatingObservation[] }[] = [
    { toDomain: 'energy', observations: obs.energy },
    { toDomain: 'mood', observations: obs.mood },
  ];

  const relationshipResults: Record<
    'energy' | 'mood',
    { relationshipWritten: boolean; discoveryWritten: boolean }
  > = {
    energy: { relationshipWritten: false, discoveryWritten: false },
    mood: { relationshipWritten: false, discoveryWritten: false },
  };

  for (const source of ratingSources) {
    const relResult = analyzeCycleRatingRelationship(cycles, result.deltas, source.observations);
    const relationshipDraft = buildRelationship(relResult);
    const discoveryDraft = buildCycleDiscovery(relResult, source.toDomain);
    relationshipResults[source.toDomain] = await upsertRelationshipAndDiscovery(
      supabase,
      userId,
      'cycle',
      source.toDomain,
      understandingId,
      relationshipDraft?.strength ?? null,
      relResult.confidence,
      discoveryDraft
    );
  }

  return {
    wrote: true,
    strength: draft.strength,
    confidence: result.confidence,
    energy: relationshipResults.energy,
    mood: relationshipResults.mood,
  };
}

async function processSleepDomain(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  obs: LoadedObservations,
  skipIfUnchanged = false
) {
  const result = analyzeSleep(obs.sleep);
  const draft = buildSleepUnderstanding(result);
  if (!draft) return { wrote: false, reason: !result.eligible ? 'not-eligible' : 'no-data' };

  const firstNight =
    obs.sleep.length > 0
      ? obs.sleep.reduce((min, o) => (o.startTime < min ? o.startTime : min), obs.sleep[0].startTime)
      : null;

  const understandingId = await upsertUnderstanding(
    supabase,
    userId,
    'sleep',
    draft,
    result.observationIds,
    result.totalNights,
    result.confidence,
    firstNight ? firstNight.slice(0, 10) : null,
    {
      first: 'A pattern in how much you sleep started to show.',
      changed: `This pattern has held across ${result.totalNights} nights now.`,
    },
    'health_data',
    skipIfUnchanged
  );

  // Energy and mood are collected identically (same 1-4 curiosity scale),
  // so the same relationship test runs against each independently — a
  // short night can predict one, both, or neither, and each gets its own
  // Relationship row rather than being conflated.
  const ratingSources: { toDomain: 'energy' | 'mood'; observations: RatingObservation[] }[] = [
    { toDomain: 'energy', observations: obs.energy },
    { toDomain: 'mood', observations: obs.mood },
  ];

  const relationshipResults: Record<
    'energy' | 'mood',
    { relationshipWritten: boolean; discoveryWritten: boolean }
  > = { energy: { relationshipWritten: false, discoveryWritten: false }, mood: { relationshipWritten: false, discoveryWritten: false } };

  for (const source of ratingSources) {
    const relResult = analyzeSleepRatingRelationship(obs.sleep, source.observations);
    const discoveryDraft = buildSleepRatingDiscovery(relResult, source.toDomain);
    relationshipResults[source.toDomain] = await upsertRelationshipAndDiscovery(
      supabase,
      userId,
      'sleep',
      source.toDomain,
      understandingId,
      relResult.eligible ? strengthForConfidence(relResult.confidence) : null,
      relResult.confidence,
      discoveryDraft
    );
  }

  return {
    wrote: true,
    strength: draft.strength,
    confidence: result.confidence,
    energy: relationshipResults.energy,
    mood: relationshipResults.mood,
  };
}

/** Standalone 'recovery' Understanding — until recently 'recovery' had no
 * signal at all. Filed as recovery rather than energy specifically so it
 * can cleanly relate *to* energy/mood the same way cycle and sleep do
 * (filing it under 'energy' itself would make a recovery -> energy
 * Relationship a nonsensical energy -> energy self-reference).
 *
 * HRV is the more direct physiological recovery signal, so it's
 * authoritative whenever it's available; steps remains the fallback for
 * users who haven't synced HRV yet (or whose device doesn't report it) —
 * exactly the behavior this domain had before HRV ingestion existed. */
async function processRecoveryDomain(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  obs: LoadedObservations,
  skipIfUnchanged = false
) {
  const hrvResult = analyzeHrv(obs.hrv);
  const hrvDraft = buildHrvUnderstanding(hrvResult);
  const stepsResult = analyzeSteps(obs.steps);
  const stepsDraft = buildStepsUnderstanding(stepsResult);

  const usingHrv = hrvDraft !== null;
  const draft = hrvDraft ?? stepsDraft;
  if (!draft) {
    return {
      wrote: false,
      reason: !hrvResult.eligible && !stepsResult.eligible ? 'not-eligible' : 'no-data',
    };
  }

  const observationIds = usingHrv ? hrvResult.observationIds : stepsResult.observationIds;
  const weight = usingHrv ? hrvResult.totalDays : stepsResult.totalDays;
  const confidence = usingHrv ? hrvResult.confidence : stepsResult.confidence;
  const sourceDates = usingHrv
    ? obs.hrv.map((o) => o.recordedAt)
    : obs.steps.map((o) => o.recordedAt);
  const firstDay =
    sourceDates.length > 0
      ? sourceDates.reduce((min, d) => (d < min ? d : min), sourceDates[0])
      : null;

  const understandingId = await upsertUnderstanding(
    supabase,
    userId,
    'recovery',
    draft,
    observationIds,
    weight,
    confidence,
    firstDay ? firstDay.slice(0, 10) : null,
    {
      first: usingHrv
        ? 'A pattern in your heart rate variability started to show.'
        : 'A pattern in how much you move day to day started to show.',
      changed: `This pattern has held across ${weight} days now.`,
    },
    'health_data',
    skipIfUnchanged
  );

  // Same rationale as cycle and sleep: energy and mood are collected
  // identically, so both get their own independent Relationship test.
  const ratingSources: { toDomain: 'energy' | 'mood'; observations: RatingObservation[] }[] = [
    { toDomain: 'energy', observations: obs.energy },
    { toDomain: 'mood', observations: obs.mood },
  ];

  const relationshipResults: Record<
    'energy' | 'mood',
    { relationshipWritten: boolean; discoveryWritten: boolean }
  > = {
    energy: { relationshipWritten: false, discoveryWritten: false },
    mood: { relationshipWritten: false, discoveryWritten: false },
  };

  for (const source of ratingSources) {
    const relResult = usingHrv
      ? analyzeHrvRatingRelationship(obs.hrv, source.observations)
      : analyzeStepsRatingRelationship(obs.steps, source.observations);
    const discoveryDraft = usingHrv
      ? buildHrvRatingDiscovery(relResult, source.toDomain)
      : buildStepsRatingDiscovery(relResult, source.toDomain);
    relationshipResults[source.toDomain] = await upsertRelationshipAndDiscovery(
      supabase,
      userId,
      'recovery',
      source.toDomain,
      understandingId,
      relResult.eligible ? strengthForConfidence(relResult.confidence) : null,
      relResult.confidence,
      discoveryDraft
    );
  }

  return {
    wrote: true,
    primarySignal: usingHrv ? 'hrv' : 'steps',
    strength: draft.strength,
    confidence,
    energy: relationshipResults.energy,
    mood: relationshipResults.mood,
  };
}

/** Standalone 'mood' Understanding — the last domain that was purely a
 * Relationship target with nothing describing it on its own. No
 * relationship/discovery step: mood_rating is already the *target* signal
 * everywhere else, so a mood -> mood relationship would be as nonsensical
 * as the energy -> energy one 'recovery' was designed to avoid. */
async function processMoodDomain(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  obs: LoadedObservations,
  skipIfUnchanged = false
) {
  const result = analyzeMood(obs.mood);
  const draft = buildMoodUnderstanding(result);
  if (!draft) return { wrote: false, reason: !result.eligible ? 'not-eligible' : 'no-data' };

  const firstAnswer =
    obs.mood.length > 0
      ? obs.mood.reduce((min, o) => (o.recordedAt < min ? o.recordedAt : min), obs.mood[0].recordedAt)
      : null;

  await upsertUnderstanding(
    supabase,
    userId,
    'mood',
    draft,
    result.observationIds,
    result.totalAnswers,
    result.confidence,
    firstAnswer ? firstAnswer.slice(0, 10) : null,
    {
      first: 'A pattern in how you report your mood started to show.',
      changed: `This pattern has held across ${result.totalAnswers} check ins now.`,
    },
    'health_data',
    skipIfUnchanged
  );

  return { wrote: true, strength: draft.strength, confidence: result.confidence };
}

/**
 * The one non-physiological domain processor — builds an initial,
 * user-reported Understanding from the onboarding conversation's own
 * concern/elaboration/recency answers. Everything about how it writes is
 * identical to the four processors above it (same upsertUnderstanding(),
 * same Evidence row, same history log); the only real difference is where
 * the draft comes from and one extra guard: it never overwrites a domain
 * that already has a real physiological ('health_data') Understanding —
 * the two are meant to complement each other, not compete, and a
 * measured pattern always outranks a self-report of the same domain.
 * (The reverse is exactly what already happens for free: once a
 * physiological processor above writes 'health_data' for the same domain,
 * this function's own guard sees it next run and steps aside for good.)
 */
async function processContextualDomain(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  obs: LoadedObservations,
  skipIfUnchanged = false
) {
  if (!obs.concern) return { wrote: false, reason: 'no-data' };

  // The elaboration's own classification goes first — free text is
  // typically more specific than the fixed concern chip it followed (see
  // the comment on health_concern_detail in loadObservations above).
  const domain = mapConcernToDomain([
    ...(obs.concernElaboration?.healthDomains ?? []),
    ...obs.concern.healthDomains,
  ]);

  const draft = buildContextualUnderstanding(domain, {
    concernAnswer: obs.concern.answer,
    concernElaboration: obs.concernElaboration?.answer ?? null,
    recency: obs.concernRecency?.answer ?? null,
  });
  if (!draft) return { wrote: false, reason: 'not-eligible' };

  const { data: existing, error: existingError } = await supabase
    .from('understandings')
    .select('evidence_type')
    .eq('user_id', userId)
    .eq('domain', domain)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.evidence_type === 'health_data') {
    return { wrote: false, reason: 'superseded-by-physiological-understanding', domain };
  }

  const observationIds = [
    obs.concern.id,
    obs.concernElaboration?.id,
    obs.concernRecency?.id,
  ].filter((id): id is string => !!id);

  await upsertUnderstanding(
    supabase,
    userId,
    domain,
    draft,
    observationIds,
    observationIds.length,
    // A single self-report is never more than the system's own lowest
    // confidence value — there's no sample size to speak of.
    0.3,
    obs.concern.recordedAt.slice(0, 10),
    {
      first: 'Noted what you shared about this during onboarding.',
      changed: 'Updated based on what you shared during onboarding.',
    },
    'user_reported',
    skipIfUnchanged
  );

  return { wrote: true, domain, strength: draft.strength };
}

/**
 * Provider Feedback -> Evidence — the one new step this task adds. Turns
 * any provider_assessment/provider_outcome Observation not yet reflected
 * in Evidence into exactly one new `evidence` row (evidence_type =
 * 'provider_reported') plus one new `understanding_history` entry on the
 * Understanding it names — nothing else. In particular:
 *
 *   - Never writes to `understandings.strength`, `.narrative`,
 *     `.confidence_label`, or `.last_updated` — this function has no
 *     access to upsertUnderstanding() at all, so there is no path by which
 *     feedback could itself manufacture or upgrade a Guidance-eligible
 *     Understanding. The normal Evidence -> Understanding -> Guidance
 *     gates (ACTIONABLE strength, evidence_type checks) are entirely
 *     untouched by this function; a future engine change that wants
 *     'provider_reported' evidence to actually inform strength would have
 *     to do that explicitly, in upsertUnderstanding() or a processor, not
 *     get it for free here.
 *   - Never rewrites a past Evidence or understanding_history row — only
 *     ever inserts, and only once per feedback observation (see
 *     selectNewProviderFeedbackDrafts()'s idempotency check against
 *     already-recorded observation ids).
 *   - Only ever attaches to an Understanding this user actually owns (see
 *     the ownership check in providerFeedbackEvidence.ts) — a
 *     client-supplied understandingId that doesn't belong to this user is
 *     silently skipped, not trusted.
 */
async function processProviderFeedbackEvidence(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  obs: LoadedObservations
) {
  if (obs.providerFeedback.length === 0) return { wrote: 0 };

  const { data: understandingRows, error: understandingError } = await supabase
    .from('understandings')
    .select('id')
    .eq('user_id', userId);
  if (understandingError) throw understandingError;
  const ownedUnderstandingIds = new Set((understandingRows ?? []).map((u) => u.id as string));

  const { data: existingProviderEvidence, error: evidenceError } = await supabase
    .from('evidence')
    .select('observation_ids')
    .eq('user_id', userId)
    .eq('evidence_type', 'provider_reported');
  if (evidenceError) throw evidenceError;
  const alreadyRecorded = new Set<string>();
  for (const row of existingProviderEvidence ?? []) {
    for (const id of (row.observation_ids as string[]) ?? []) alreadyRecorded.add(id);
  }

  const drafts = selectNewProviderFeedbackDrafts(
    obs.providerFeedback,
    alreadyRecorded,
    ownedUnderstandingIds
  );

  for (const draft of drafts) {
    const { error: insertEvidenceError } = await supabase.from('evidence').insert({
      user_id: userId,
      domain: draft.domain,
      observation_ids: [draft.observationId],
      weight: 1,
      confidence: null,
      evidence_type: 'provider_reported',
    });
    if (insertEvidenceError) throw insertEvidenceError;

    const { error: insertHistoryError } = await supabase.from('understanding_history').insert({
      understanding_id: draft.understandingId,
      user_id: userId,
      event_date: draft.eventDate,
      label: draft.historyLabel,
    });
    if (insertHistoryError) throw insertHistoryError;
  }

  return { wrote: drafts.length };
}

interface ContributingUnderstandingRow {
  id: string;
  domain: string;
  strength: string;
  evidence_type: string;
  learning_since: string | null;
  observations_count: number;
}

/**
 * Cross-Domain Synthesis — the one new step in the pipeline this feature
 * adds: Observation -> Evidence -> Domain Understanding -> [this] ->
 * Guidance -> Care Connection. Runs after every physiological processor
 * and processContextualDomain() above, reading only what this run itself
 * already wrote to `understandings` and `relationships` — never raw
 * Observations or Evidence directly, and never anything from outside this
 * user's own data.
 *
 * All of the actual eligibility logic (which pairs qualify, what strength
 * the result gets, what its provenance is) lives in
 * buildCrossDomainDraft() — a pure function, fully covered by
 * crossDomainSynthesis.test.ts. This function is only the I/O around it:
 * load this user's relationships and understandings, hand each qualifying
 * pair to that pure function, and — for anything it doesn't return null
 * for — call the exact same deriveGuidance() every domain processor
 * already calls before upserting.
 */
async function processCrossDomainSynthesis(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: relationshipRows, error: relError } = await supabase
    .from('relationships')
    .select('from_domain, to_domain, strength')
    .eq('user_id', userId);
  if (relError) throw relError;

  const { data: understandingRows, error: understandingError } = await supabase
    .from('understandings')
    .select('id, domain, strength, evidence_type, learning_since, observations_count')
    .eq('user_id', userId);
  if (understandingError) throw understandingError;

  const byDomain = new Map<string, ContributingUnderstandingRow>();
  for (const row of (understandingRows ?? []) as ContributingUnderstandingRow[]) {
    byDomain.set(row.domain, row);
  }

  const results: { fromDomain: string; toDomain: string; wrote: boolean }[] = [];

  for (const rel of (relationshipRows ?? []) as { from_domain: string; to_domain: string; strength: string }[]) {
    const from = byDomain.get(rel.from_domain);
    const to = byDomain.get(rel.to_domain);
    if (!from || !to) {
      results.push({ fromDomain: rel.from_domain, toDomain: rel.to_domain, wrote: false });
      continue;
    }

    const draft = buildCrossDomainDraft(
      { fromDomain: rel.from_domain as Domain, toDomain: rel.to_domain as Domain, strength: rel.strength },
      {
        id: from.id,
        domain: from.domain as Domain,
        strength: from.strength as Strength,
        evidenceType: from.evidence_type,
        learningSince: from.learning_since,
        observationsCount: from.observations_count,
      },
      {
        id: to.id,
        domain: to.domain as Domain,
        strength: to.strength as Strength,
        evidenceType: to.evidence_type,
        learningSince: to.learning_since,
        observationsCount: to.observations_count,
      }
    );

    if (!draft) {
      results.push({ fromDomain: rel.from_domain, toDomain: rel.to_domain, wrote: false });
      continue;
    }

    // The exact same function every domain processor already calls, with
    // the pair's priority domain as `domain` (so a cycle-involving pattern
    // keeps routing to ob-gyn via careGuidance.ts's own DOMAIN_CARE_TYPE,
    // unchanged) and the other domain in the pair as `connectedDomain` —
    // reusing deriveGuidance()'s existing "appears connected to your X"
    // sentence for exactly the case it was already built for.
    const { guidance, careRecommendationType, careRecommendationReason } = deriveGuidance(
      draft.primaryDomain,
      draft.strength,
      draft.otherDomain,
      { observationsCount: draft.observationsCount, learningSince: draft.learningSinceAnchor }
    );

    const { error: upsertError } = await supabase.from('cross_domain_understandings').upsert(
      {
        user_id: userId,
        from_domain: draft.fromDomain,
        to_domain: draft.toDomain,
        label: draft.label,
        narrative: draft.narrative,
        strength: draft.strength,
        confidence_label: draft.confidenceLabel,
        contributing_understanding_ids: draft.contributingUnderstandingIds,
        still_learning: draft.stillLearning,
        guidance,
        care_recommendation_type: careRecommendationType,
        care_recommendation_reason: careRecommendationReason,
        first_observed: draft.learningSinceAnchor,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'user_id,from_domain,to_domain' }
    );
    if (upsertError) throw upsertError;

    results.push({ fromDomain: rel.from_domain, toDomain: rel.to_domain, wrote: true });
  }

  return results;
}

const STALE_AFTER_DAYS = 21;

/**
 * Walks back any understanding this run did not refresh.
 *
 * Without this the engine only ever accumulates: an understanding formed in
 * July stays "very confident" forever, even if the behaviour behind it
 * changed completely in September. For claims about someone's body, silently
 * over-claiming is the more harmful direction to be wrong in — so a domain
 * that stops producing evidence steps down one rung at a time and says so in
 * its history.
 */
async function decayStaleUnderstandings(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  refreshedDomains: string[]
) {
  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 86400000).toISOString();

  const { data: stale, error } = await supabase
    .from('understandings')
    .select('id, domain, strength, last_updated')
    .eq('user_id', userId)
    .lt('last_updated', cutoff);
  if (error) throw error;

  const decayed: string[] = [];
  for (const u of stale ?? []) {
    if (refreshedDomains.includes(u.domain as string)) continue;

    const decayedState = nextDecayedState(u.strength as string);
    if (!decayedState) continue;

    // strength and confidence_label are written together here so they can
    // never disagree — previously only strength was updated, which could
    // leave a row reading e.g. strength='moderate' next to a
    // confidence_label of 'confident' left over from when it was 'strong'.
    const { error: updateError } = await supabase
      .from('understandings')
      .update({
        strength: decayedState.strength,
        confidence_label: decayedState.confidenceLabel,
        last_updated: new Date().toISOString(),
      })
      .eq('id', u.id);
    if (updateError) throw updateError;

    const { error: historyError } = await supabase.from('understanding_history').insert({
      understanding_id: u.id,
      user_id: userId,
      event_date: new Date().toISOString().slice(0, 10),
      label: "There hasn't been enough recent evidence to stay as confident about this.",
    });
    if (historyError) throw historyError;

    decayed.push(u.domain as string);
  }
  return decayed;
}

const skipped = { wrote: false as const, reason: 'not-in-plan' };

async function applyMorningState(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  writes: MorningWrite[]
) {
  const domain = selectMorningDomain(writes);
  if (!domain) return { featured: null as string | null };
  const { error } = await supabase
    .from('understandings')
    .update({ last_updated: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('domain', domain);
  if (error) throw error;
  return { featured: domain };
}

function discoveryMinted(result: {
  energy?: { discoveryWritten?: boolean };
  mood?: { discoveryWritten?: boolean };
}): boolean {
  return !!(result.energy?.discoveryWritten || result.mood?.discoveryWritten);
}

async function announceDiscoveries(userId: string) {
  await fetch(`${supabaseUrl}/functions/v1/notify-discoveries`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
}

async function processUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  plan: RunPlan = planForMode('nightly'),
  skipIfUnchanged = false
) {
  const want = new Set<ProcessorName>(plan.processors);
  const obs = await loadObservations(supabase, userId);
  const [cycle, sleep, recovery, mood] = await Promise.all([
    want.has('cycle') ? processCycleDomain(supabase, userId, obs, skipIfUnchanged) : skipped,
    want.has('sleep') ? processSleepDomain(supabase, userId, obs, skipIfUnchanged) : skipped,
    want.has('recovery') ? processRecoveryDomain(supabase, userId, obs, skipIfUnchanged) : skipped,
    want.has('mood') ? processMoodDomain(supabase, userId, obs, skipIfUnchanged) : skipped,
  ]);

  // Runs after, not alongside, the four physiological processors above —
  // its "don't overwrite a real physiological Understanding" guard reads
  // current DB state, which needs to reflect whatever this run's own
  // physiological writes just did.
  const contextual = want.has('contextual')
    ? await processContextualDomain(supabase, userId, obs, skipIfUnchanged)
    : skipped;

  // Nightly only: deeper cross-domain synthesis. Continuous runs skip this
  // so a single HR sample cannot fire the entire engine.
  const crossDomain = plan.runCrossDomain
    ? await processCrossDomainSynthesis(supabase, userId)
    : [];

  // Independent of cross-domain synthesis — order between the two doesn't
  // matter, since neither reads the other's output — but both need this
  // run's own `understandings` state, so both run after the physiological
  // processors and processContextualDomain() above.
  const providerFeedback = want.has('provider_feedback')
    ? await processProviderFeedbackEvidence(supabase, userId, obs)
    : { wrote: 0 };

  const refreshed = [
    cycle?.wrote ? 'cycle' : null,
    sleep?.wrote ? 'sleep' : null,
    recovery?.wrote ? 'recovery' : null,
    mood?.wrote ? 'mood' : null,
    contextual && 'domain' in contextual && contextual.wrote ? contextual.domain : null,
  ].filter((d): d is string => d !== null);

  const decayed = plan.runDecay
    ? await decayStaleUnderstandings(supabase, userId, refreshed)
    : [];

  const morningWrites: MorningWrite[] = [
    { domain: 'cycle', wroteThisRun: !!cycle?.wrote },
    { domain: 'sleep', wroteThisRun: !!sleep?.wrote },
    { domain: 'recovery', wroteThisRun: !!recovery?.wrote },
    { domain: 'mood', wroteThisRun: !!mood?.wrote },
    {
      domain:
        contextual && 'domain' in contextual && typeof contextual.domain === 'string'
          ? contextual.domain
          : 'contextual',
      wroteThisRun: !!contextual?.wrote,
    },
  ];
  const morning = plan.runMorningState
    ? await applyMorningState(supabase, userId, morningWrites)
    : { featured: null };

  const minted =
    discoveryMinted(cycle) || discoveryMinted(sleep) || discoveryMinted(recovery);
  if (minted) {
    try {
      await announceDiscoveries(userId);
    } catch {
      // Nightly notify-discoveries cron is the fallback; a failed
      // same-run announce must not fail intelligence writes.
    }
  }

  return {
    userId,
    cycle,
    sleep,
    recovery,
    mood,
    contextual,
    crossDomain,
    providerFeedback,
    decayed,
    morning,
  };
}

interface IntelligenceWorkRow {
  user_id: string;
  processors: string[];
  observation_types: string[];
  latest_observation_id: string | null;
  not_before: string;
  last_run_at: string | null;
  last_fingerprint: string | null;
  force_run: boolean;
}

function numericFromValue(type: string, value: Record<string, unknown> | null): number | null {
  if (!value) return null;
  if (type === 'hrv' && typeof value.ms === 'number') return value.ms;
  if ((type === 'heart_rate' || type === 'resting_heart_rate') && typeof value.bpm === 'number') {
    return value.bpm;
  }
  if (type === 'steps' && typeof value.count === 'number') return value.count;
  if (type === 'body_temperature' || type === 'wrist_temperature' || type === 'temperature') {
    if (typeof value.celsius === 'number') return value.celsius;
    if (typeof value.fahrenheit === 'number') return value.fahrenheit;
  }
  return null;
}

async function meaningfulChangeForTypes(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  types: string[]
): Promise<boolean> {
  for (const type of types) {
    if (type === 'hrv') {
      const { data, error } = await supabase
        .from('observations')
        .select('id, recorded_at, value, context')
        .eq('user_id', userId)
        .eq('type', 'hrv')
        .order('recorded_at', { ascending: true });
      if (error) throw error;
      const hrv: HrvObservation[] = [];
      for (const row of data ?? []) {
        const ms = (row.value as { ms?: number } | null)?.ms;
        if (typeof ms !== 'number') continue;
        const metric = (row.context as { metric?: string } | null)?.metric;
        hrv.push({
          id: row.id as string,
          recordedAt: row.recorded_at as string,
          ms,
          metric: typeof metric === 'string' ? metric : null,
        });
      }
      if (latestDayIsLowVsPersonalBaseline(hrv)) return true;
      continue;
    }

    // Instantaneous heart_rate has no personal-baseline processor of its
    // own — recovery is HRV/steps. Do not invent a pairwise HR swing.
    if (type === 'heart_rate') continue;

    const { data, error } = await supabase
      .from('observations')
      .select('value, context')
      .eq('user_id', userId)
      .eq('type', type)
      .order('recorded_at', { ascending: false })
      .limit(2);
    if (error) throw error;
    const rows = data ?? [];
    const latest = rows[0];
    const previous = rows[1];
    if (
      isMeaningfulChange({
        type,
        previousValue: numericFromValue(type, (previous?.value as Record<string, unknown>) ?? null),
        nextValue: numericFromValue(type, (latest?.value as Record<string, unknown>) ?? null),
        cycleStart: latest?.context?.cycleStart === true,
      })
    ) {
      return true;
    }
  }
  return false;
}

async function clearWork(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fingerprint: string
) {
  const { error } = await supabase
    .from('intelligence_work')
    .update({
      processors: [],
      observation_types: [],
      latest_observation_id: null,
      force_run: false,
      last_fingerprint: fingerprint,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw error;
}

async function deferWork(supabase: ReturnType<typeof createClient>, userId: string, notBeforeMs: number) {
  const { error } = await supabase
    .from('intelligence_work')
    .update({
      not_before: new Date(notBeforeMs).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw error;
}

async function runContinuous(supabase: ReturnType<typeof createClient>, explicitUserId?: string) {
  let query = supabase
    .from('intelligence_work')
    .select(
      'user_id, processors, observation_types, latest_observation_id, not_before, last_run_at, last_fingerprint, force_run'
    )
    .lte('not_before', new Date().toISOString())
    .not('observation_types', 'eq', '{}');
  if (explicitUserId) query = query.eq('user_id', explicitUserId);

  const { data, error } = await query;
  if (error) throw error;

  const results = [];
  for (const row of (data ?? []) as IntelligenceWorkRow[]) {
    const types = row.observation_types ?? [];
    const nowMs = Date.now();
    const meaningful = row.force_run
      ? true
      : await meaningfulChangeForTypes(supabase, row.user_id, types);
    const decision = decideContinuousDrain({
      userId: row.user_id,
      observationTypes: types,
      latestObservationId: row.latest_observation_id,
      lastFingerprint: row.last_fingerprint,
      lastRunAt: row.last_run_at,
      forceRun: row.force_run,
      nowMs,
      meaningfulChange: meaningful,
    });

    if (decision.action === 'skip-empty') continue;
    if (decision.action === 'skip-idempotent') {
      await clearWork(
        supabase,
        row.user_id,
        runFingerprint(row.user_id, processorsForObservationTypes(types), row.latest_observation_id)
      );
      results.push({ userId: row.user_id, skipped: 'idempotent' });
      continue;
    }
    if (decision.action === 'skip-debounced') {
      await deferWork(supabase, row.user_id, decision.nextNotBeforeMs);
      results.push({ userId: row.user_id, skipped: 'debounced' });
      continue;
    }

    try {
      const planned = planForMode('continuous', types);
      const processed = await processUser(
        supabase,
        row.user_id,
        { ...planned, processors: decision.processors },
        true
      );
      await clearWork(
        supabase,
        row.user_id,
        runFingerprint(row.user_id, processorsForObservationTypes(types), row.latest_observation_id)
      );
      results.push(processed);
    } catch (e) {
      await deferWork(supabase, row.user_id, retryNotBeforeMs(nowMs));
      results.push({ userId: row.user_id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return results;
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const explicitUserId = body?.user_id as string | undefined;
    const mode: EngineMode =
      body?.mode === 'continuous' || body?.mode === 'morning' ? body.mode : 'nightly';

    if (mode === 'continuous') {
      const results = await runContinuous(supabase, explicitUserId);
      return new Response(JSON.stringify({ processed: results.length, mode, results }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let userIds: string[];
    if (explicitUserId) {
      userIds = [explicitUserId];
    } else {
      const { data, error } = await supabase
        .from('observations')
        .select('user_id')
        .in('type', [
          'resting_heart_rate',
          'menstrual_flow',
          'sleep_session',
          'sleep_segment',
          'steps',
          'hrv',
          'mood_rating',
          // A user with only onboarding observations and no physiological
          // data yet still deserves the nightly run's own initial,
          // contextual Understanding — this is the same discovery query
          // the four physiological processors already share, just no
          // longer blind to the one non-physiological source that also
          // produces an Understanding.
          'health_concern',
          // Same reasoning, for the newest source: a user whose only new
          // activity since the last run was logging provider feedback
          // still deserves processProviderFeedbackEvidence() actually
          // running for them tonight, not waiting for unrelated
          // physiological data to happen to arrive too.
          'provider_assessment',
          'provider_outcome',
        ]);
      if (error) throw error;
      userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];
    }

    const plan = planForMode(mode);
    const results = [];
    for (const userId of userIds) {
      try {
        results.push(await processUser(supabase, userId, plan, mode !== 'nightly'));
      } catch (e) {
        results.push({ userId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, mode, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
