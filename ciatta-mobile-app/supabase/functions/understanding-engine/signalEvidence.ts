import {
  comparableKey,
  originKey,
  type NormalizedSignal,
} from './normalizedSignal.ts';

export interface EvidenceSeries {
  series: NormalizedSignal[];
  withheld: NormalizedSignal[];
  retainedIds: string[];
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

/**
 * Intelligence consumes a comparable evidence series, never a device list.
 * Every observation stays retained; incompatible measurement definitions
 * are withheld from the series rather than blended.
 */
export function selectEvidenceSeries(
  signals: NormalizedSignal[],
  signalType: string
): EvidenceSeries {
  const ofType = signals.filter((s) => s.signalType === signalType);
  const retainedIds = ofType.map((s) => s.observationId);

  if (ofType.length === 0) {
    return { series: [], withheld: [], retainedIds };
  }

  const tagged = ofType.filter((s) => s.measurement.metric);
  const untagged = ofType.filter((s) => !s.measurement.metric);

  const partitions = groupBy(
    tagged.length > 0 ? tagged : ofType,
    comparableKey
  );

  let selected: NormalizedSignal[] = [];
  for (const [, group] of partitions) {
    if (group.length > selected.length) {
      selected = group;
    }
  }

  if (tagged.length > 0 && untagged.length > 0) {
    selected = [...selected, ...untagged];
  }

  if (selected.length === 0) selected = ofType;

  const kind = selected[0]?.kind ?? 'state';
  if (kind === 'additive') {
    selected = pickAdditiveOrigins(selected);
  }

  const selectedIds = new Set(selected.map((s) => s.observationId));
  const withheld = ofType.filter((s) => !selectedIds.has(s.observationId));

  return { series: selected, withheld, retainedIds };
}

function pickAdditiveOrigins(signals: NormalizedSignal[]): NormalizedSignal[] {
  const byDay = groupBy(signals, (s) => dayKey(s.recordedAt));
  const picked: NormalizedSignal[] = [];
  for (const [, daySignals] of byDay) {
    const byOrigin = groupBy(daySignals, originKey);
    let best: NormalizedSignal[] = [];
    let bestSum = -1;
    for (const [, originSignals] of byOrigin) {
      const sum = originSignals.reduce((n, s) => n + s.value, 0);
      if (sum > bestSum || (sum === bestSum && originSignals.length > best.length)) {
        bestSum = sum;
        best = originSignals;
      }
    }
    picked.push(...best);
  }
  return picked;
}

export function toHrvObservations(series: NormalizedSignal[]): {
  id: string;
  recordedAt: string;
  ms: number;
  metric?: string | null;
}[] {
  return series.map((s) => ({
    id: s.observationId,
    recordedAt: s.recordedAt,
    ms: s.value,
    metric: s.measurement.metric ?? null,
  }));
}

export function toStepsObservations(series: NormalizedSignal[]): {
  id: string;
  recordedAt: string;
  count: number;
}[] {
  return series.map((s) => ({
    id: s.observationId,
    recordedAt: s.recordedAt,
    count: s.value,
  }));
}

export function toRhrObservations(series: NormalizedSignal[]): {
  id: string;
  recordedAt: string;
  bpm: number;
}[] {
  return series.map((s) => ({
    id: s.observationId,
    recordedAt: s.recordedAt,
    bpm: s.value,
  }));
}
