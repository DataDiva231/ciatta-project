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
  analyzeEnergyRelationship,
  buildRelationship,
  buildDiscovery,
  type EnergyObservation,
} from './energyRelationship.ts';
import {
  analyzeSleep,
  buildSleepUnderstanding,
  analyzeSleepEnergyRelationship,
  buildSleepEnergyDiscovery,
  type SleepObservation,
} from './sleepAnalysis.ts';

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
  sleep: SleepObservation[];
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
      'sleep_session',
      'sleep_segment',
    ])
    .order('recorded_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as ObservationRow[];
  const flow: FlowObservation[] = [];
  const rhr: RhrObservation[] = [];
  const energy: EnergyObservation[] = [];
  const sleep: SleepObservation[] = [];

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
    }
  }

  return { flow, rhr, energy, sleep };
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
 * Discovery exactly once (checked against existing ones by understanding
 * id, so repeated nightly runs never duplicate it). */
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

  const relResult = analyzeEnergyRelationship(cycles, result.deltas, obs.energy);
  const relationshipDraft = buildRelationship(relResult);
  const discoveryDraft = buildDiscovery(relResult);
  const { relationshipWritten, discoveryWritten } = await upsertRelationshipAndDiscovery(
    supabase,
    userId,
    'cycle',
    'energy',
    understandingId,
    relationshipDraft?.strength ?? null,
    relResult.confidence,
    discoveryDraft
  );

  return {
    wrote: true,
    strength: draft.strength,
    confidence: result.confidence,
    relationshipWritten,
    discoveryWritten,
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

  const relResult = analyzeSleepEnergyRelationship(obs.sleep, obs.energy);
  const discoveryDraft = buildSleepEnergyDiscovery(relResult);
  const { relationshipWritten, discoveryWritten } = await upsertRelationshipAndDiscovery(
    supabase,
    userId,
    'sleep',
    'energy',
    understandingId,
    relResult.eligible ? strengthForConfidence(relResult.confidence) : null,
    relResult.confidence,
    discoveryDraft
  );

  return {
    wrote: true,
    strength: draft.strength,
    confidence: result.confidence,
    relationshipWritten,
    discoveryWritten,
  };
}

async function processUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const obs = await loadObservations(supabase, userId);
  const [cycle, sleep] = await Promise.all([
    processCycleDomain(supabase, userId, obs),
    processSleepDomain(supabase, userId, obs),
  ]);
  return { userId, cycle, sleep };
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
        .in('type', ['resting_heart_rate', 'menstrual_flow', 'sleep_session', 'sleep_segment']);
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
