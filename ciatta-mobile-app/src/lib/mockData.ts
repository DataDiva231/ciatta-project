import { Platform } from 'react-native';
import type { ConnectionItem, Domain, HealthItem } from './types';

// Presentation constants: the fixed vocabulary of the app (which domains
// exist, how strengths are worded, which profile rows to render).
// Real user data comes from Supabase — nothing here describes a person.



export const connections: ConnectionItem[] = [
  {
    id: 'health-source',
    label: Platform.OS === 'android' ? 'Health Connect' : 'Apple Health',
    status: 'not-connected',
  },
  { id: 'medical-records', label: 'Medical records', status: 'not-connected' },
  { id: 'arc', label: 'Ciatta Arc™', status: 'coming-soon' },
];

export const healthItems: HealthItem[] = [
  { id: 'cycle', label: 'Cycle', value: 'Not shared yet' },
  { id: 'medical-history', label: 'Medical history', value: 'Not shared yet' },
  { id: 'conditions', label: 'Health conditions', value: 'Not shared yet' },
  { id: 'medications', label: 'Medications & supplements', value: 'Not shared yet' },
  { id: 'pregnancy', label: 'Pregnancy history', value: 'Not shared yet' },
  { id: 'family-history', label: 'Family history', value: 'Not shared yet' },
  { id: 'allergies', label: 'Allergies', value: 'Not shared yet' },
];

export const domains: Domain[] = ['sleep', 'recovery', 'energy', 'cycle', 'mood'];

export const domainLabel: Record<Domain, string> = {
  sleep: 'Sleep',
  recovery: 'Recovery',
  energy: 'Energy',
  cycle: 'Cycle',
  mood: 'Mood',
};

// Describes how well a *domain* is understood. The wording used to say
// "…relationship", which only makes sense for a link between two domains —
// every caller is describing a single understanding, so it read as
// nonsense ("Sleep — very strong relationship").
export const strengthLabel: Record<string, string> = {
  'very-strong': 'Very well understood',
  strong: 'Well understood',
  moderate: 'Taking shape',
  emerging: 'Just beginning',
};

export const strengthShort: Record<string, string> = {
  'very-strong': 'Very strong',
  strong: 'Strong',
  moderate: 'Moderate',
  emerging: 'Emerging',
};




export const evolutionStages = [
  { id: 'week1', label: 'Week 1', caption: 'Your picture is just beginning.', density: 0 },
  { id: 'month6', label: '6 Months', caption: 'Patterns are beginning to show.', density: 1 },
  { id: 'year1', label: '1 Year', caption: 'Connections are deepening.', density: 2 },
  { id: 'year3', label: '3 Years', caption: 'A living picture of you.', density: 3 },
];
