/**
 * Tampon wear intelligence. Lives next to priority and visit prep as a
 * pure, testable slice of the existing intelligence layer. It does not
 * write or rewrite the cycle Understanding (luteal heart rate stays the
 * cycle processor's job).
 *
 * Personalized timing can only pull the check/change window earlier.
 * The FDA safety ceiling is eight hours and is never exceeded.
 * Insertion time is only used when the caller already confirmed it.
 */
import { displayCopy, displayCopyList } from './displayCopy';

export const FDA_MAX_WEAR_MS = 8 * 60 * 60 * 1000;
const MIN_AFTER_INSERT_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TamponAbsorbency = 'light' | 'regular' | 'super' | 'super plus';
export type FlowLevel = 'none' | 'light' | 'medium' | 'heavy' | 'unspecified';
export type BleedingPattern = 'regular' | 'irregular' | 'unknown';
export type TamponTimerState =
  | 'idle'
  | 'insufficient'
  | 'watching'
  | 'checkSoon'
  | 'changeNow'
  | 'safetyLimit';

export type TamponWearEventType = 'tampon_inserted' | 'tampon_removed' | 'tampon_leak';

export interface TamponWearEvent {
  type: TamponWearEventType;
  recordedAt: string;
  absorbency?: TamponAbsorbency | null;
}

export interface FlowDay {
  recordedAt: string;
  flow?: FlowLevel | null;
  cycleStart?: boolean | null;
}

export interface TamponWearInput {
  now: Date;
  insertionTime: Date | null;
  absorbency: TamponAbsorbency | null;
  cycleDay: number | null;
  currentFlow: FlowLevel | null;
  historicalFlowOnCycleDay: FlowLevel[];
  bleedingPattern: BleedingPattern;
  reportedConditions: string[];
  priorLeaksOnCycleDay: number;
  priorLeaksOverall: number;
}

export interface TamponWearUnderstanding {
  insertionTime: string | null;
  product: { type: 'tampon'; absorbency: string } | null;
  currentFlowContext: string;
  recommendedCheckTime: string | null;
  recommendedChangeWindow: { start: string; end: string } | null;
  safetyDeadline: string | null;
  confidence: number;
  confidenceLabel: string;
  reasoning: string[];
  activeTimerState: TamponTimerState;
  narrative: string;
  safetyLimitNote: string;
}

export interface TamponNotificationCue {
  id: 'checkSoon' | 'changeNow' | 'safetyLimit';
  fireAt: string;
  body: string;
}

const ABSORBENCY_MINUTES: Record<TamponAbsorbency, { check: number; changeStart: number; changeEnd: number }> = {
  light: { check: 210, changeStart: 240, changeEnd: 330 },
  regular: { check: 180, changeStart: 210, changeEnd: 300 },
  super: { check: 150, changeStart: 180, changeEnd: 270 },
  'super plus': { check: 120, changeStart: 150, changeEnd: 240 },
};

const UNKNOWN_MINUTES = { check: 150, changeStart: 180, changeEnd: 270 };

const CONDITION_SIGNALS = [
  'heavy period',
  'heavy periods',
  'heavy bleeding',
  'menorrhagia',
  'fibroid',
  'fibroids',
  'endometriosis',
  'adenomyosis',
  'flooding',
  'clot',
  'clots',
];

export function resolveActiveInsertion(events: TamponWearEvent[]): {
  insertedAt: Date;
  absorbency: TamponAbsorbency | null;
} | null {
  const sorted = [...events].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  let active: { insertedAt: Date; absorbency: TamponAbsorbency | null } | null = null;
  for (const event of sorted) {
    if (event.type === 'tampon_inserted') {
      active = {
        insertedAt: new Date(event.recordedAt),
        absorbency: event.absorbency ?? null,
      };
    } else if (event.type === 'tampon_removed') {
      active = null;
    }
  }
  return active;
}

export function cycleDayFromFlow(flow: FlowDay[], now: Date): number | null {
  const starts = flow
    .filter((row) => row.cycleStart)
    .map((row) => new Date(row.recordedAt).getTime())
    .filter((t) => t <= now.getTime())
    .sort((a, b) => b - a);
  if (starts.length > 0) {
    return Math.max(1, Math.floor((now.getTime() - starts[0]) / DAY_MS) + 1);
  }
  const bleedDays = [
    ...new Set(
      flow
        .filter((row) => row.flow && row.flow !== 'none' && row.flow !== 'unspecified')
        .map((row) => new Date(row.recordedAt).toISOString().slice(0, 10))
    ),
  ].sort();
  if (bleedDays.length === 0) return null;
  const todayKey = now.toISOString().slice(0, 10);
  let streakStart = bleedDays[bleedDays.length - 1];
  for (let i = bleedDays.length - 1; i >= 0; i--) {
    if (i === 0) {
      streakStart = bleedDays[0];
      break;
    }
    const prev = new Date(bleedDays[i - 1] + 'T00:00:00.000Z').getTime();
    const cur = new Date(bleedDays[i] + 'T00:00:00.000Z').getTime();
    if (cur - prev > DAY_MS * 1.5) {
      streakStart = bleedDays[i];
      break;
    }
    streakStart = bleedDays[i - 1];
  }
  if (todayKey < streakStart) return null;
  const lastBleed = bleedDays[bleedDays.length - 1];
  if (new Date(todayKey + 'T00:00:00.000Z').getTime() - new Date(lastBleed + 'T00:00:00.000Z').getTime() > DAY_MS * 2) {
    return null;
  }
  return Math.max(1, Math.floor((new Date(todayKey).getTime() - new Date(streakStart).getTime()) / DAY_MS) + 1);
}

export function typicalFlowOnCycleDay(levels: FlowLevel[]): FlowLevel | null {
  const counted = levels.filter((l) => l === 'light' || l === 'medium' || l === 'heavy');
  if (counted.length === 0) return null;
  const rank = { light: 1, medium: 2, heavy: 3 };
  const sum = counted.reduce((acc, l) => acc + rank[l], 0);
  const avg = sum / counted.length;
  if (avg >= 2.5) return 'heavy';
  if (avg >= 1.5) return 'medium';
  return 'light';
}

function pullMinutes(input: TamponWearInput): { minutes: number; reasons: string[] } {
  let minutes = 0;
  const reasons: string[] = [];
  if (input.currentFlow === 'heavy') {
    minutes += 60;
    reasons.push('Current flow is heavy, so Ciatta pulls the check earlier.');
  } else if (input.currentFlow === 'medium') {
    minutes += 25;
    reasons.push('Current flow is medium, so Ciatta pulls the check a little earlier.');
  }
  const typical = typicalFlowOnCycleDay(input.historicalFlowOnCycleDay);
  if (typical === 'heavy') {
    minutes += 40;
    reasons.push('Your flow is typically heavier around this point in your cycle.');
  }
  if (input.bleedingPattern === 'irregular') {
    minutes += 20;
    reasons.push('Bleeding has been irregular, so Ciatta stays conservative.');
  }
  if (input.priorLeaksOnCycleDay > 0) {
    minutes += 45;
    reasons.push('You have leaked around this point in your cycle before.');
  } else if (input.priorLeaksOverall >= 2) {
    minutes += 20;
    reasons.push('Earlier leaks are part of your history, so Ciatta checks sooner.');
  }
  const joined = input.reportedConditions.join(' ').toLowerCase();
  if (CONDITION_SIGNALS.some((signal) => joined.includes(signal))) {
    minutes += 30;
    reasons.push('You have shared bleeding context that calls for an earlier check.');
  }
  return { minutes, reasons };
}

function confidenceFor(input: TamponWearInput): { value: number; label: string } {
  if (!input.insertionTime) return { value: 0, label: 'still learning' };
  let value = 0.28;
  if (input.absorbency) value += 0.18;
  if (input.currentFlow && input.currentFlow !== 'unspecified' && input.currentFlow !== 'none') value += 0.16;
  if (input.cycleDay != null) value += 0.08;
  if (input.historicalFlowOnCycleDay.length >= 2) value += 0.12;
  if (input.bleedingPattern !== 'unknown') value += 0.06;
  if (input.priorLeaksOverall > 0 || input.reportedConditions.length > 0) value += 0.08;
  value = Math.min(0.82, value);
  const label =
    value < 0.3 ? 'still learning' : value < 0.6 ? 'fairly confident' : 'confident';
  return { value, label };
}

function flowContextCopy(input: TamponWearInput): string {
  const typical = typicalFlowOnCycleDay(input.historicalFlowOnCycleDay);
  if (input.currentFlow === 'heavy' || typical === 'heavy') {
    return displayCopy('Your flow is typically heavier around this point in your cycle.');
  }
  if (input.currentFlow === 'medium' || typical === 'medium') {
    return displayCopy('Your flow is in a medium range around this point in your cycle.');
  }
  if (input.currentFlow === 'light' || typical === 'light') {
    return displayCopy('Your flow has been on the lighter side around this point in your cycle.');
  }
  if (input.bleedingPattern === 'irregular') {
    return displayCopy('Your bleeding pattern has been irregular, so timing stays conservative.');
  }
  if (!input.insertionTime) {
    return displayCopy('Ciatta needs a confirmed insertion time before it can time a tampon.');
  }
  return displayCopy('Ciatta is still learning how your flow moves through a cycle day.');
}

function narrativeFor(state: TamponTimerState, flowContext: string): string {
  if (state === 'idle' || state === 'insufficient') {
    return displayCopy('Ciatta can time a tampon once you confirm you put one in.');
  }
  if (state === 'checkSoon') {
    return displayCopy(`${flowContext} You may want to check your tampon soon.`);
  }
  if (state === 'changeNow' || state === 'safetyLimit') {
    return displayCopy("It's time to change your tampon.");
  }
  if (flowContext.includes('heavier')) {
    return displayCopy(`${flowContext} You may want to check your tampon soon.`);
  }
  return displayCopy(`${flowContext} Ciatta is watching this wear against your usual flow.`);
}

function timerState(now: Date, check: Date, changeStart: Date, safety: Date): TamponTimerState {
  if (now.getTime() >= safety.getTime()) return 'safetyLimit';
  if (now.getTime() >= changeStart.getTime()) return 'changeNow';
  if (now.getTime() >= check.getTime()) return 'checkSoon';
  return 'watching';
}

export function evaluateTamponWear(input: TamponWearInput): TamponWearUnderstanding {
  const safetyLimitNote = displayCopy(
    'The safety limit is eight hours of wear. Personalized timing never goes past that.'
  );
  const flowContext = flowContextCopy(input);

  if (!input.insertionTime) {
    const confidence = confidenceFor(input);
    return {
      insertionTime: null,
      product: null,
      currentFlowContext: flowContext,
      recommendedCheckTime: null,
      recommendedChangeWindow: null,
      safetyDeadline: null,
      confidence: confidence.value,
      confidenceLabel: confidence.label,
      reasoning: displayCopyList([
        'Insertion time is only used when you confirm it. Ciatta does not guess it.',
        safetyLimitNote,
      ]),
      activeTimerState: 'insufficient',
      narrative: narrativeFor('insufficient', flowContext),
      safetyLimitNote,
    };
  }

  const inserted = input.insertionTime;
  const safety = new Date(inserted.getTime() + FDA_MAX_WEAR_MS);
  const base = input.absorbency ? ABSORBENCY_MINUTES[input.absorbency] : UNKNOWN_MINUTES;
  const pull = pullMinutes(input);
  const checkMs = Math.max(MIN_AFTER_INSERT_MS, (base.check - pull.minutes) * 60 * 1000);
  const startMs = Math.max(checkMs + 15 * 60 * 1000, (base.changeStart - pull.minutes) * 60 * 1000);
  const endMs = Math.max(startMs + 15 * 60 * 1000, (base.changeEnd - pull.minutes) * 60 * 1000);

  const check = new Date(Math.min(inserted.getTime() + checkMs, safety.getTime() - 30 * 60 * 1000));
  const changeStart = new Date(Math.min(inserted.getTime() + startMs, safety.getTime() - 15 * 60 * 1000));
  const changeEnd = new Date(Math.min(inserted.getTime() + endMs, safety.getTime()));
  const safeCheck = check.getTime() < inserted.getTime() + MIN_AFTER_INSERT_MS
    ? new Date(inserted.getTime() + MIN_AFTER_INSERT_MS)
    : check;
  const safeStart = changeStart.getTime() <= safeCheck.getTime()
    ? new Date(Math.min(safeCheck.getTime() + 15 * 60 * 1000, safety.getTime()))
    : changeStart;
  const safeEnd = changeEnd.getTime() <= safeStart.getTime()
    ? new Date(Math.min(safeStart.getTime() + 15 * 60 * 1000, safety.getTime()))
    : changeEnd;

  const state = timerState(input.now, safeCheck, safeStart, safety);
  const confidence = confidenceFor(input);
  const absorbencyLabel = input.absorbency ?? 'unspecified';
  const reasoning = displayCopyList([
    input.absorbency
      ? `Product is a ${input.absorbency} absorbency tampon.`
      : 'Absorbency was not shared, so the window stays conservative.',
    ...pull.reasons,
    'Personalized timing can move earlier. It cannot pass the eight hour safety limit.',
    safetyLimitNote,
  ]);

  return {
    insertionTime: inserted.toISOString(),
    product: { type: 'tampon', absorbency: absorbencyLabel },
    currentFlowContext: flowContext,
    recommendedCheckTime: safeCheck.toISOString(),
    recommendedChangeWindow: {
      start: safeStart.toISOString(),
      end: safeEnd.toISOString(),
    },
    safetyDeadline: safety.toISOString(),
    confidence: confidence.value,
    confidenceLabel: confidence.label,
    reasoning,
    activeTimerState: state,
    narrative: narrativeFor(state, flowContext),
    safetyLimitNote,
  };
}

export function tamponNotificationPlan(
  understanding: TamponWearUnderstanding,
  now: Date
): TamponNotificationCue[] {
  if (!understanding.insertionTime || !understanding.recommendedCheckTime) return [];
  const cues: TamponNotificationCue[] = [];
  const maybe = (id: TamponNotificationCue['id'], iso: string | null, body: string) => {
    if (!iso) return;
    if (new Date(iso).getTime() <= now.getTime()) return;
    cues.push({ id, fireAt: iso, body: displayCopy(body) });
  };
  maybe('checkSoon', understanding.recommendedCheckTime, 'You may want to check your tampon soon.');
  maybe('changeNow', understanding.recommendedChangeWindow?.start ?? null, "It's time to change your tampon.");
  maybe('safetyLimit', understanding.safetyDeadline, "It's time to change your tampon.");
  return cues;
}

export function recentBleed(flow: FlowDay[], now: Date, withinDays = 2): boolean {
  const cutoff = now.getTime() - withinDays * DAY_MS;
  return flow.some((row) => {
    const t = new Date(row.recordedAt).getTime();
    if (t < cutoff) return false;
    return row.flow === 'light' || row.flow === 'medium' || row.flow === 'heavy';
  });
}
