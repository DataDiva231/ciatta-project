// Understanding Engine — computes real Understandings from Observations.
// Runs server-side only, using the service_role key (bypasses RLS by
// design — see the comment at the top of the init migration). Never called
// from the mobile client; invoked nightly by pg_cron (see the
// schedule_understanding_engine migration) or manually for a single user
// via `supabase functions invoke understanding-engine --body '{"user_id":"..."}'`.
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
  type HrvObservation,
} from './hrvAnalysis.ts';
import { analyzeMood, buildMoodUnderstanding } from './moodAnalysis.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ObservationRow {
  id: string;
  type: string;
  recorded_at: string;
  value: Record<string, unknown>;
  context: Record<string, unknown>;
}

interface LoadedObservations {
  flow: FlowObservation[];
  rhr: RhrObservation[];
  energy: EnergyObservation[];
  mood: RatingObservation[];
  sleep: SleepObservation[];
  steps: StepsObservation[];
  hrv: HrvObservation[];
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
        hrv.push({ id: row.id, recordedAt: row.recorded_at, ms });
      }
    }
  }

  return { flow, rhr, energy, mood, sleep, steps, hrv };
}

interface UnderstandingDraftLike {
  strength: Strength;
  narrative: string;
  confidenceLabel: string;
  stillLearning?: string[];
}

/** Writes Evidence + upserts the Understanding + logs history on change. */
async function upsertUnderstanding(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  domain: string,
  draft: UnderstandingDraftLike,
  observationIds: string[],
  weight: number,
  confidence: number,
  firstObserved: string | null,
  historyLabel: { first: string; changed: string }
): Promise<string> {
  const { error: evidenceError } = await supabase.from('evidence').insert({
    user_id: userId,
    domain,
    observation_ids: observationIds.slice(-500),
    weight,
    confidence,
  });
  if (evidenceError) throw evidenceError;

  const { data: existing, error: fetchError } = await supabase
    .from('understandings')
    .select('id, strength')
    .eq('user_id', userId)
    .eq('domain', domain)
    .maybeSingle();
  if (fetchError) throw fetchError;

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
  obs: LoadedObservations
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
      first: 'Noticed a possible heart-rate pattern tied to your cycle.',
      changed: `This pattern has held for ${result.cyclesWithSufficientData} cycles now.`,
    }
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
  obs: LoadedObservations
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
      first: 'Noticed a pattern in how much you sleep.',
      changed: `This pattern has held across ${result.totalNights} nights now.`,
    }
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
  obs: LoadedObservations
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
        ? 'Noticed a pattern in your heart rate variability.'
        : 'Noticed a pattern in how much you move day to day.',
      changed: `This pattern has held across ${weight} days now.`,
    }
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
  obs: LoadedObservations
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
      first: 'Noticed a pattern in how you report your mood.',
      changed: `This pattern has held across ${result.totalAnswers} check-ins now.`,
    }
  );

  return { wrote: true, strength: draft.strength, confidence: result.confidence };
}

/** Confidence ladder, strongest first. */
const STRENGTH_LADDER = ['very-strong', 'strong', 'moderate', 'emerging'] as const;
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

    const idx = STRENGTH_LADDER.indexOf(u.strength as typeof STRENGTH_LADDER[number]);
    if (idx === -1 || idx === STRENGTH_LADDER.length - 1) continue;
    const next = STRENGTH_LADDER[idx + 1];

    const { error: updateError } = await supabase
      .from('understandings')
      .update({ strength: next, last_updated: new Date().toISOString() })
      .eq('id', u.id);
    if (updateError) throw updateError;

    const { error: historyError } = await supabase.from('understanding_history').insert({
      understanding_id: u.id,
      user_id: userId,
      event_date: new Date().toISOString().slice(0, 10),
      label: "I haven't seen enough recently to stay as confident about this.",
    });
    if (historyError) throw historyError;

    decayed.push(u.domain as string);
  }
  return decayed;
}

async function processUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const obs = await loadObservations(supabase, userId);
  const [cycle, sleep, recovery, mood] = await Promise.all([
    processCycleDomain(supabase, userId, obs),
    processSleepDomain(supabase, userId, obs),
    processRecoveryDomain(supabase, userId, obs),
    processMoodDomain(supabase, userId, obs),
  ]);

  const refreshed = [
    cycle?.wrote ? 'cycle' : null,
    sleep?.wrote ? 'sleep' : null,
    recovery?.wrote ? 'recovery' : null,
    mood?.wrote ? 'mood' : null,
  ].filter((d): d is string => d !== null);

  const decayed = await decayStaleUnderstandings(supabase, userId, refreshed);

  return { userId, cycle, sleep, recovery, mood, decayed };
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const explicitUserId = body?.user_id as string | undefined;

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
        ]);
      if (error) throw error;
      userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];
    }

    const results = [];
    for (const userId of userIds) {
      try {
        results.push(await processUser(supabase, userId));
      } catch (e) {
        results.push({ userId, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
