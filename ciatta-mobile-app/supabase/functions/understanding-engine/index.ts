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
  type FlowObservation,
  type RhrObservation,
} from './cycleAnalysis.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ObservationRow {
  id: string;
  type: string;
  recorded_at: string;
  value: Record<string, unknown>;
  context: Record<string, unknown>;
}

async function loadObservations(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ flow: FlowObservation[]; rhr: RhrObservation[] }> {
  const { data, error } = await supabase
    .from('observations')
    .select('id, type, recorded_at, value, context')
    .eq('user_id', userId)
    .in('type', ['resting_heart_rate', 'menstrual_flow'])
    .order('recorded_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as ObservationRow[];
  const flow: FlowObservation[] = [];
  const rhr: RhrObservation[] = [];

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
    }
  }

  return { flow, rhr };
}

async function processUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const { flow, rhr } = await loadObservations(supabase, userId);
  const cycles = detectCycles(flow);
  const result = analyzeCycles(cycles, rhr);
  const draft = buildUnderstanding(result);

  if (!draft) {
    return { userId, wrote: false, reason: !result ? 'no-data' : 'not-eligible' };
  }

  const observationIds = result.observationIds.slice(-500);

  const { error: evidenceError } = await supabase.from('evidence').insert({
    user_id: userId,
    domain: 'cycle',
    observation_ids: observationIds,
    weight: result.cyclesWithSufficientData,
    confidence: result.confidence,
  });
  if (evidenceError) throw evidenceError;

  const { data: existing, error: fetchError } = await supabase
    .from('understandings')
    .select('id, strength')
    .eq('user_id', userId)
    .eq('domain', 'cycle')
    .maybeSingle();
  if (fetchError) throw fetchError;

  const { data: upserted, error: upsertError } = await supabase
    .from('understandings')
    .upsert(
      {
        user_id: userId,
        domain: 'cycle',
        strength: draft.strength,
        narrative: draft.narrative,
        confidence_label: draft.confidenceLabel,
        observations_count: observationIds.length,
        first_observed: result.firstCycleStart
          ? result.firstCycleStart.toISOString().slice(0, 10)
          : null,
        learning_since:
          existing?.strength == null
            ? result.firstCycleStart?.toISOString().slice(0, 10)
            : undefined,
        last_updated: new Date().toISOString(),
        still_learning: draft.stillLearning,
      },
      { onConflict: 'user_id,domain' }
    )
    .select('id')
    .single();
  if (upsertError) throw upsertError;

  if (!existing || existing.strength !== draft.strength) {
    const label = existing
      ? `This pattern has held for ${result.cyclesWithSufficientData} cycles now.`
      : 'Noticed a possible heart-rate pattern tied to your cycle.';
    const { error: historyError } = await supabase.from('understanding_history').insert({
      understanding_id: upserted.id,
      user_id: userId,
      event_date: new Date().toISOString().slice(0, 10),
      label,
    });
    if (historyError) throw historyError;
  }

  return { userId, wrote: true, strength: draft.strength, confidence: result.confidence };
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
        .in('type', ['resting_heart_rate', 'menstrual_flow']);
      if (error) throw error;
      userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];
    }

    const results = [];
    for (const userId of userIds) {
      try {
        results.push(await processUser(supabase, userId));
      } catch (e) {
        results.push({ userId, wrote: false, error: e instanceof Error ? e.message : String(e) });
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
