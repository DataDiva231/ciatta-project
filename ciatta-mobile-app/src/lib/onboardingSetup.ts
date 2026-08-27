export interface PendingHealthDocument {
  id: string;
  name: string;
  kind: 'file' | 'photo';
}

export interface OnboardingSetupNotesInput {
  pendingHealthNotes: Record<string, string>;
  pendingDocuments?: PendingHealthDocument[];
  suggestedTests?: string[];
  includeMentalEmotional?: boolean;
}

export const SUGGESTED_HEALTH_TESTS = [
  { id: 'blood-panel', label: 'Comprehensive blood panel' },
  { id: 'thyroid', label: 'Thyroid panel' },
  { id: 'hormone', label: 'Hormone panel' },
  { id: 'dexa', label: 'Bone density scan' },
  { id: 'sleep-study', label: 'Sleep study' },
] as const;

export const WEARABLE_SOURCES = [
  {
    id: 'oura',
    label: 'Oura',
    data: 'Sleep, temperature, and recovery, when shared with Apple Health or Health Connect.',
  },
  {
    id: 'whoop',
    label: 'WHOOP',
    data: 'Strain, recovery, and sleep, when shared with Apple Health or Health Connect.',
  },
  {
    id: 'garmin',
    label: 'Garmin',
    data: 'Activity, heart rate, and sleep, when shared with Apple Health or Health Connect.',
  },
  {
    id: 'strava',
    label: 'Strava',
    data: 'Workouts and activity, when shared with Apple Health or Health Connect.',
  },
] as const;

export const HEALTH_SOURCE_DATA_POINTS = [
  'Sleep',
  'Activity and steps',
  'Heart rate and HRV',
  'Cycle history',
];

export const MEDICAL_IMPORT_POINTS = [
  'Visits and encounter notes',
  'Lab results',
  'Medications',
  'Diagnoses already on file',
];

export function notesFromOnboardingSetup(
  draft: OnboardingSetupNotesInput
): Record<string, string> {
  const notes = { ...draft.pendingHealthNotes };
  const documents = draft.pendingDocuments ?? [];
  if (documents.length > 0) {
    notes['health-documents'] = documents
      .map((doc) => `${doc.name} (${doc.kind === 'photo' ? 'photo' : 'file'})`)
      .join('\n');
  }
  const tests = draft.suggestedTests ?? [];
  if (tests.length > 0) {
    const labels = tests.flatMap((id) => {
      const match = SUGGESTED_HEALTH_TESTS.find((row) => row.id === id);
      return match ? [match.label] : [];
    });
    if (labels.length > 0) notes['suggested-tests'] = labels.join('\n');
  }
  if (draft.includeMentalEmotional) {
    notes['mental-emotional'] = 'Included as part of the whole picture.';
  }
  return Object.fromEntries(Object.entries(notes).filter(([, text]) => text.trim()));
}
