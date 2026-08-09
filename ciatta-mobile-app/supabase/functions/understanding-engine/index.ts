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
import { analyzeSteps, buildStepsUnderstanding, type StepsObservation } from './stepsAnalysis.ts';

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
    }
  }

  return { flow, rhr, energy, mood, sleep, steps };
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

/** Standalone 'energy' Understanding from steps — until now 'energy' only
 * ever appeared as a Relationship target, never described on its own. No
 * relationship/discovery step here yet, purely descriptive like sleep. */
async function processEnergyDomain(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  obs: LoadedObservations
) {
  const result = analyzeSteps(obs.steps);
  const draft = buildStepsUnderstanding(result);
  if (!draft) return { wrote: false, reason: !result.eligible ? 'not-eligible' : 'no-data' };

  const firstDay =
    obs.steps.length > 0
      ? obs.steps.reduce((min, o) => (o.recordedAt < min ? o.recordedAt : min), obs.steps[0].recordedAt)
      : null;

  await upsertUnderstanding(
    supabase,
    userId,
    'energy',
    draft,
    result.observationIds,
    result.totalDays,
    result.confidence,
    firstDay ? firstDay.slice(0, 10) : null,
    {
      first: 'Noticed a pattern in how much you move day to day.',
      changed: `This pattern has held across ${result.totalDays} days now.`,
    }
  );

  return { wrote: true, strength: draft.strength, confidence: result.confidence };
}

async function processUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const obs = await loadObservations(supabase, userId);
  const [cycle, sleep, energy] = await Promise.all([
    processCycleDomain(supabase, userId, obs),
    processSleepDomain(supabase, userId, obs),
    processEnergyDomain(supabase, userId, obs),
  ]);
  return { userId, cycle, sleep, energy };
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
