import { assertEquals } from 'jsr:@std/assert@1';
import {
  notesFromOnboardingSetup,
  SUGGESTED_HEALTH_TESTS,
  WEARABLE_SOURCES,
} from './onboardingSetup.ts';

Deno.test('setup notes fold documents, tests, and mental health into health notes', () => {
  const notes = notesFromOnboardingSetup({
    pendingHealthNotes: { cycle: 'Typically 28 days' },
    pendingDocuments: [{ id: '1', name: 'CBC.pdf', kind: 'file' }],
    suggestedTests: ['blood-panel', 'unknown'],
    includeMentalEmotional: true,
  });
  assertEquals(notes.cycle, 'Typically 28 days');
  assertEquals(notes['health-documents'], 'CBC.pdf (file)');
  assertEquals(notes['suggested-tests'], 'Comprehensive blood panel');
  assertEquals(notes['mental-emotional'], 'Included as part of the whole picture.');
  assertEquals(notes.calendar, undefined);
});

Deno.test('setup notes omit empty optional sources', () => {
  const notes = notesFromOnboardingSetup({
    pendingHealthNotes: {},
    pendingDocuments: [],
    suggestedTests: [],
    includeMentalEmotional: false,
  });
  assertEquals(notes, {});
});

Deno.test('wearable sources and suggested tests stay product copy, not clinical product names', () => {
  assertEquals(
    WEARABLE_SOURCES.map((s) => s.label),
    ['Oura', 'WHOOP', 'Garmin', 'Strava']
  );
  assertEquals(SUGGESTED_HEALTH_TESTS.length > 0, true);
});
