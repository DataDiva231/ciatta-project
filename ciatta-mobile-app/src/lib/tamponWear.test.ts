import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  FDA_MAX_WEAR_MS,
  cycleDayFromFlow,
  evaluateTamponWear,
  resolveActiveInsertion,
  tamponNotificationPlan,
  typicalFlowOnCycleDay,
  type TamponWearInput,
} from './tamponWear.ts';

const INSERT = new Date('2026-08-27T12:00:00.000Z');

function base(over: Partial<TamponWearInput> = {}): TamponWearInput {
  return {
    now: new Date(INSERT.getTime() + 30 * 60 * 1000),
    insertionTime: INSERT,
    absorbency: 'regular',
    cycleDay: 2,
    currentFlow: 'medium',
    historicalFlowOnCycleDay: ['medium', 'medium'],
    bleedingPattern: 'regular',
    reportedConditions: [],
    priorLeaksOnCycleDay: 0,
    priorLeaksOverall: 0,
    ...over,
  };
}

function hoursFromInsert(iso: string | null): number {
  assert(iso);
  return (new Date(iso).getTime() - INSERT.getTime()) / (60 * 60 * 1000);
}

Deno.test('does not invent an insertion time', () => {
  const out = evaluateTamponWear(base({ insertionTime: null }));
  assertEquals(out.insertionTime, null);
  assertEquals(out.recommendedCheckTime, null);
  assertEquals(out.safetyDeadline, null);
  assertEquals(out.activeTimerState, 'insufficient');
  assert(out.reasoning.some((line) => line.includes('does not guess')));
});

Deno.test('safety deadline is always eight hours after confirmed insertion', () => {
  const out = evaluateTamponWear(base());
  assertEquals(new Date(out.safetyDeadline!).getTime() - INSERT.getTime(), FDA_MAX_WEAR_MS);
  assert(hoursFromInsert(out.recommendedChangeWindow!.end) <= 8);
  assert(hoursFromInsert(out.recommendedCheckTime) < 8);
});

Deno.test('personalized window never passes the safety deadline even with light flow', () => {
  const out = evaluateTamponWear(
    base({ absorbency: 'light', currentFlow: 'light', historicalFlowOnCycleDay: ['light'] })
  );
  assert(new Date(out.recommendedChangeWindow!.end).getTime() <= new Date(out.safetyDeadline!).getTime());
});

Deno.test('heavier absorbency is checked earlier than light', () => {
  const light = evaluateTamponWear(base({ absorbency: 'light', currentFlow: 'light', historicalFlowOnCycleDay: [] }));
  const superPlus = evaluateTamponWear(
    base({ absorbency: 'super plus', currentFlow: 'light', historicalFlowOnCycleDay: [] })
  );
  assert(hoursFromInsert(superPlus.recommendedCheckTime) < hoursFromInsert(light.recommendedCheckTime));
});

Deno.test('heavy current flow is checked earlier than light current flow', () => {
  const light = evaluateTamponWear(base({ currentFlow: 'light', historicalFlowOnCycleDay: ['light'] }));
  const heavy = evaluateTamponWear(base({ currentFlow: 'heavy', historicalFlowOnCycleDay: ['light'] }));
  assert(hoursFromInsert(heavy.recommendedCheckTime) < hoursFromInsert(light.recommendedCheckTime));
});

Deno.test('irregular bleeding pulls the window earlier', () => {
  const regular = evaluateTamponWear(base({ bleedingPattern: 'regular' }));
  const irregular = evaluateTamponWear(base({ bleedingPattern: 'irregular' }));
  assert(hoursFromInsert(irregular.recommendedCheckTime) < hoursFromInsert(regular.recommendedCheckTime));
});

Deno.test('user reported heavy bleeding context pulls earlier without diagnosing', () => {
  const plain = evaluateTamponWear(base({ reportedConditions: [] }));
  const shared = evaluateTamponWear(base({ reportedConditions: ['Heavy periods and fibroids'] }));
  assert(hoursFromInsert(shared.recommendedCheckTime) < hoursFromInsert(plain.recommendedCheckTime));
  assert(!shared.reasoning.some((line) => /diagnos/i.test(line)));
});

Deno.test('prior leaks on this cycle day pull earlier', () => {
  const none = evaluateTamponWear(base({ priorLeaksOnCycleDay: 0 }));
  const leaked = evaluateTamponWear(base({ priorLeaksOnCycleDay: 1 }));
  assert(hoursFromInsert(leaked.recommendedCheckTime) < hoursFromInsert(none.recommendedCheckTime));
});

Deno.test('missing absorbency stays conservative and under eight hours', () => {
  const known = evaluateTamponWear(base());
  const out = evaluateTamponWear(base({ absorbency: null }));
  assert(hoursFromInsert(out.recommendedCheckTime) < 8);
  assert(out.confidence < known.confidence);
  assert(out.reasoning.some((line) => line.includes('Absorbency was not shared')));
});

Deno.test('timer watching, check soon, change now, then safety limit', () => {
  const watching = evaluateTamponWear(base({ now: new Date(INSERT.getTime() + 20 * 60 * 1000) }));
  assertEquals(watching.activeTimerState, 'watching');
  const check = evaluateTamponWear(base({ now: new Date(watching.recommendedCheckTime!) }));
  assertEquals(check.activeTimerState, 'checkSoon');
  const change = evaluateTamponWear(base({ now: new Date(watching.recommendedChangeWindow!.start) }));
  assertEquals(change.activeTimerState, 'changeNow');
  assert(change.narrative.includes('time to change'));
  const safety = evaluateTamponWear(base({ now: new Date(INSERT.getTime() + FDA_MAX_WEAR_MS) }));
  assertEquals(safety.activeTimerState, 'safetyLimit');
  assert(safety.narrative.includes('time to change'));
});

Deno.test('heavier cycle day history shapes the flow context copy', () => {
  assertEquals(typicalFlowOnCycleDay(['heavy', 'heavy', 'medium']), 'heavy');
  const out = evaluateTamponWear(base({ historicalFlowOnCycleDay: ['heavy', 'heavy'], currentFlow: 'medium' }));
  assert(out.currentFlowContext.includes('heavier'));
});

Deno.test('resolveActiveInsertion persists until a remove, leaks do not clear it', () => {
  const active = resolveActiveInsertion([
    { type: 'tampon_inserted', recordedAt: '2026-08-27T12:00:00.000Z', absorbency: 'regular' },
    { type: 'tampon_leak', recordedAt: '2026-08-27T13:00:00.000Z' },
  ]);
  assertEquals(active?.absorbency, 'regular');
  const cleared = resolveActiveInsertion([
    { type: 'tampon_inserted', recordedAt: '2026-08-27T12:00:00.000Z', absorbency: 'regular' },
    { type: 'tampon_removed', recordedAt: '2026-08-27T14:00:00.000Z' },
  ]);
  assertEquals(cleared, null);
});

Deno.test('cycle day uses a confirmed cycle start, not a guess from insertion', () => {
  const day = cycleDayFromFlow(
    [{ recordedAt: '2026-08-26T08:00:00.000Z', cycleStart: true, flow: 'medium' }],
    new Date('2026-08-27T12:00:00.000Z')
  );
  assertEquals(day, 2);
});

Deno.test('notification plan is not a generic countdown and skips past cues', () => {
  const out = evaluateTamponWear(base({ now: INSERT }));
  const plan = tamponNotificationPlan(out, INSERT);
  assertEquals(plan.map((c) => c.id), ['checkSoon', 'changeNow', 'safetyLimit']);
  assert(plan.every((c) => new Date(c.fireAt).getTime() > INSERT.getTime()));
  assert(plan[0].body.includes('check your tampon soon'));
  const later = tamponNotificationPlan(out, new Date(out.safetyDeadline!));
  assertEquals(later.length, 0);
});
