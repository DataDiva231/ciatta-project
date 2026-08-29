import { supabase } from './supabase';
import { insertObservation } from './observations';
import {
  cycleDayFromFlow,
  evaluateTamponWear,
  recentBleed,
  resolveActiveInsertion,
  type BleedingPattern,
  type FlowDay,
  type FlowLevel,
  type TamponAbsorbency,
  type TamponWearEvent,
  type TamponWearUnderstanding,
} from './tamponWear';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function parseAbsorbency(value: unknown): TamponAbsorbency | null {
  const raw = String(asRecord(value).absorbency ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (raw === 'light' || raw === 'regular' || raw === 'super' || raw === 'super plus') return raw;
  if (raw === 'superplus') return 'super plus';
  return null;
}

function parseFlow(value: unknown): FlowLevel | null {
  const raw = String(asRecord(value).flow ?? '').toLowerCase();
  if (raw === 'none' || raw === 'light' || raw === 'medium' || raw === 'heavy' || raw === 'unspecified') {
    return raw;
  }
  return null;
}

function parsePattern(answer: string): BleedingPattern {
  const n = answer.toLowerCase();
  if (n.includes('irregular')) return 'irregular';
  if (n.includes('regular')) return 'regular';
  return 'unknown';
}

export async function loadTamponWearUnderstanding(
  userId: string,
  now = new Date()
): Promise<{ understanding: TamponWearUnderstanding; bleedingNow: boolean }> {
  const since = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('observations')
    .select('type, value, recorded_at, context')
    .eq('user_id', userId)
    .in('type', [
      'tampon_inserted',
      'tampon_removed',
      'tampon_leak',
      'menstrual_flow',
      'cycle_regularity',
      'health_history',
    ])
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const events: TamponWearEvent[] = rows
    .filter((row) =>
      row.type === 'tampon_inserted' || row.type === 'tampon_removed' || row.type === 'tampon_leak'
    )
    .map((row) => ({
      type: row.type as TamponWearEvent['type'],
      recordedAt: row.recorded_at,
      absorbency: parseAbsorbency(row.value),
    }));

  const flow: FlowDay[] = rows
    .filter((row) => row.type === 'menstrual_flow')
    .map((row) => ({
      recordedAt: row.recorded_at,
      flow: parseFlow(row.value),
      cycleStart: (row.context as { cycleStart?: boolean | null } | null)?.cycleStart ?? null,
    }));

  const regularityRow = [...rows].reverse().find((row) => row.type === 'cycle_regularity');
  const historyRows = rows.filter((row) => row.type === 'health_history');
  const active = resolveActiveInsertion(events);
  const cycleDay = cycleDayFromFlow(flow, now);
  const currentFlow =
    [...flow].reverse().find((row) => row.flow && row.flow !== 'none')?.flow ?? null;
  const historicalFlowOnCycleDay = flow
    .filter((row) => cycleDay != null && cycleDayFromFlow(flow, new Date(row.recordedAt)) === cycleDay)
    .map((row) => row.flow)
    .filter((level): level is FlowLevel => !!level);

  const leakTimes = events.filter((e) => e.type === 'tampon_leak').map((e) => new Date(e.recordedAt));
  const priorLeaksOnCycleDay = leakTimes.filter(
    (t) => cycleDay != null && cycleDayFromFlow(flow, t) === cycleDay
  ).length;

  const understanding = evaluateTamponWear({
    now,
    insertionTime: active?.insertedAt ?? null,
    absorbency: active?.absorbency ?? null,
    cycleDay,
    currentFlow,
    historicalFlowOnCycleDay,
    bleedingPattern: parsePattern(String(asRecord(regularityRow?.value).answer ?? '')),
    reportedConditions: historyRows.map((row) => String(asRecord(row.value).answer ?? '')).filter(Boolean),
    priorLeaksOnCycleDay,
    priorLeaksOverall: leakTimes.length,
  });

  return { understanding, bleedingNow: recentBleed(flow, now) };
}

export async function confirmTamponInserted(userId: string, absorbency: TamponAbsorbency) {
  const recordedAt = new Date().toISOString();
  await insertObservation(userId, {
    source: 'manual',
    type: 'tampon_inserted',
    value: { product: 'tampon', absorbency },
    recordedAt,
    context: { confirmedByUser: true },
  });
}

export async function confirmTamponRemoved(userId: string) {
  await insertObservation(userId, {
    source: 'manual',
    type: 'tampon_removed',
    value: { product: 'tampon' },
    recordedAt: new Date().toISOString(),
    context: { confirmedByUser: true },
  });
}
