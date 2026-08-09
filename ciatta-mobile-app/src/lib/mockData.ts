import { Platform } from 'react-native';
import type { ConnectionItem, Domain, EvidenceRow, HealthItem } from './types';

// Static mock data standing in for the Understanding Engine + Supabase.
// Shape follows: Observation -> Evidence -> Understanding -> Relationship -> Discovery -> Core -> Today

export const user = {
  id: 'u_jenny',
  name: 'Jennifer Maxwell',
  preferredName: 'Jenny',
  age: 28,
  dob: '1998-03-14',
  pronouns: 'she/her',
  lifeStage: 'Reproductive Years',
  location: 'Austin, TX',
  goals: [
    'Understand my energy',
    'Sleep more consistently',
    'Notice patterns in my cycle',
  ],
  about: 'Runs most mornings. Travels for work every few weeks.',
};

export const todayLabel = 'Thursday, August 7';

export const connections: ConnectionItem[] = [
  {
    id: 'health-source',
    label: Platform.OS === 'android' ? 'Health Connect' : 'Apple Health',
    status: 'not-connected',
  },
  { id: 'medical-records', label: 'Medical records', status: 'not-connected' },
  { id: 'arc', label: 'Ciatta Arc™', status: 'coming-soon' },
  { id: 'webbee', label: 'Webbee™', status: 'coming-soon' },
  { id: 'clinician', label: 'Clinician access', status: 'not-connected' },
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

export const strengthLabel: Record<string, string> = {
  'very-strong': 'Very strong relationship',
  strong: 'Strong relationship',
  moderate: 'Moderate relationship',
  emerging: 'Emerging relationship',
};

export const strengthShort: Record<string, string> = {
  'very-strong': 'Very strong',
  strong: 'Strong',
  moderate: 'Moderate',
  emerging: 'Emerging',
};

export const todayUnderstanding = {
  headline: 'Your body appears to be asking for recovery today.',
  body: [
    'Sleep quality has quietly declined over the last three nights while your resting heart rate has remained elevated.',
    'Because your nervous system has been under some pressure, your body may need more recovery than usual today.',
  ],
  disclaimer: 'Nothing currently suggests a health concern.',
  activeDomain: 'recovery' as Domain,
  evidence: [
    { label: 'Sleep quality', value: '-18%', context: 'vs 3-night avg', direction: 'down' },
    { label: 'Recovery', value: '-22%', context: 'vs 7-day avg', direction: 'down' },
    { label: 'Resting heart rate', value: '+6 bpm', context: 'vs 7-day avg', direction: 'up' },
    { label: 'Cycle', value: 'Day 22', context: 'Luteal phase', direction: 'flat' },
  ] as EvidenceRow[],
  focus: {
    title: 'Prioritize eight hours of sleep.',
    reason: "Based on today's understanding, recovery is likely to have the greatest impact.",
  },
};

export const whySheet = {
  summary:
    'Your recent sleep, recovery, and cycle patterns point toward a higher recovery need today.',
  timeline: [
    { label: 'Yesterday', detail: 'Sleep quality decreased.' },
    { label: 'Three nights', detail: 'Recovery steadily declined.' },
    { label: 'Today', detail: 'Resting heart rate remained elevated.', active: true },
    { label: 'Previous cycles', detail: "We've observed similar patterns before." },
  ],
  confidence: 'High',
  confidencePct: 82,
  observations: 18,
  months: 4,
  stillLearning:
    "We're not yet confident whether exercise intensity contributes to today's recovery needs.",
  stillLearningHint: 'One or two additional observations could help us understand this.',
};

export const newThisWeek = "I've become more confident that recovery predicts your energy.";

export const evolutionStages = [
  { id: 'week1', label: 'Week 1', caption: 'Just getting to know you.', density: 0 },
  { id: 'month6', label: '6 Months', caption: 'Beginning to see patterns.', density: 1 },
  { id: 'year1', label: '1 Year', caption: 'Building deeper connections.', density: 2 },
  { id: 'year3', label: '3 Years', caption: 'A living model of you.', density: 3 },
];
