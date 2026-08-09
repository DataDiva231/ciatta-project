import { Platform } from 'react-native';
import type {
  ConnectionItem,
  Discovery,
  Domain,
  EvidenceRow,
  HealthItem,
  Understanding,
} from './types';

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

export const understandings: Record<Domain, Understanding> = {
  recovery: {
    id: 'und_recovery',
    domain: 'recovery',
    strength: 'very-strong',
    observations: 42,
    learningSince: 'March 2026',
    firstObserved: 'April 8, 2026',
    lastUpdated: 'Yesterday',
    confidence: 'Very high',
    narrative:
      'Recovery has become one of the strongest signals in how I understand you. When it improves, your energy and mood tend to follow within a day or two.',
    history: [
      { date: 'Apr 8', label: 'First observed' },
      { date: 'May 20', label: 'Pattern emerged' },
      { date: 'Jul 12', label: 'Relationship strengthened' },
      { date: 'Today', label: 'Confidence increased', active: true },
    ],
    stillLearning: [
      'Whether hydration influences recovery.',
      'How travel and time zones impact recovery.',
      'If seasonal changes affect recovery patterns.',
    ],
    relationships: [
      { domain: 'energy', strength: 'very-strong' },
      { domain: 'sleep', strength: 'strong' },
      { domain: 'mood', strength: 'moderate' },
    ],
  },
  sleep: {
    id: 'und_sleep',
    domain: 'sleep',
    strength: 'strong',
    observations: 38,
    learningSince: 'March 2026',
    firstObserved: 'April 8, 2026',
    lastUpdated: 'Yesterday',
    confidence: 'Very high',
    narrative:
      'Your sleep quality has become a dependable early signal. Nights with more interruptions tend to show up in lower recovery the next day.',
    history: [
      { date: 'Apr 8', label: 'First observed' },
      { date: 'May 20', label: 'Pattern emerged' },
      { date: 'Aug 12', label: 'Relationship strengthened' },
      { date: 'Today', label: 'Confidence increased', active: true },
    ],
    stillLearning: [
      'Whether hydration influences recovery.',
      'How travel and time zones impact recovery.',
      'If seasonal changes affect recovery patterns.',
    ],
    relationships: [
      { domain: 'recovery', strength: 'very-strong' },
      { domain: 'energy', strength: 'strong' },
      { domain: 'mood', strength: 'moderate' },
    ],
  },
  energy: {
    id: 'und_energy',
    domain: 'energy',
    strength: 'strong',
    observations: 31,
    learningSince: 'April 2026',
    firstObserved: 'April 22, 2026',
    lastUpdated: '3 days ago',
    confidence: 'High',
    narrative:
      'Your energy tends to track recovery closely, with about a one-day lag. Mornings after strong recovery are consistently your highest-energy mornings.',
    history: [
      { date: 'Apr 22', label: 'First observed' },
      { date: 'Jun 3', label: 'Pattern emerged' },
      { date: 'Today', label: 'Relationship strengthened', active: true },
    ],
    stillLearning: [
      'Whether caffeine timing changes the pattern.',
      'How workouts the day before affect morning energy.',
    ],
    relationships: [
      { domain: 'recovery', strength: 'very-strong' },
      { domain: 'sleep', strength: 'strong' },
    ],
  },
  cycle: {
    id: 'und_cycle',
    domain: 'cycle',
    strength: 'emerging',
    observations: 18,
    learningSince: 'April 2026',
    firstObserved: 'April 30, 2026',
    lastUpdated: '5 days ago',
    confidence: 'Medium',
    narrative:
      "I'm beginning to notice a connection between your cycle phase and your recovery, especially in the luteal phase. I need a few more cycles before I'm confident.",
    history: [
      { date: 'Apr 30', label: 'First observed' },
      { date: 'Today', label: 'Pattern emerging', active: true },
    ],
    stillLearning: [
      'Whether this holds across different cycle lengths.',
      'How the luteal phase relates to sleep quality.',
    ],
    relationships: [
      { domain: 'recovery', strength: 'moderate' },
      { domain: 'mood', strength: 'moderate' },
    ],
  },
  mood: {
    id: 'und_mood',
    domain: 'mood',
    strength: 'moderate',
    observations: 24,
    learningSince: 'May 2026',
    firstObserved: 'May 3, 2026',
    lastUpdated: '2 days ago',
    confidence: 'Medium',
    narrative:
      'Mood is harder to predict than your other patterns, but recovery and sleep both seem to play a role, especially two days after a poor night.',
    history: [
      { date: 'May 3', label: 'First observed' },
      { date: 'Jun 18', label: 'Pattern emerged' },
      { date: 'Today', label: 'Confidence increased', active: true },
    ],
    stillLearning: [
      'Whether social context changes mood more than biology.',
      'How travel affects mood independent of sleep.',
    ],
    relationships: [
      { domain: 'recovery', strength: 'moderate' },
      { domain: 'sleep', strength: 'moderate' },
    ],
  },
};

export const discoveries: Discovery[] = [
  {
    id: 'disc_recovery_rhythm',
    name: 'Recovery Rhythm',
    discoveredAt: 'July 24, 2026',
    confidence: 66,
    confidenceLabel: 'Medium',
    narrative: 'When your recovery improves, your mood usually improves within two days.',
    detail:
      "I've seen this pattern 11 times in the past 28 days. Confidence is continuing to grow.",
    understandingIds: ['und_recovery', 'und_mood'],
  },
  {
    id: 'disc_morning_lift',
    name: 'The Morning Lift',
    discoveredAt: 'July 18, 2026',
    confidence: 74,
    confidenceLabel: 'High',
    narrative: 'Mornings after your best sleep are consistently your highest-energy mornings.',
    detail:
      "I've seen this pattern 14 times since March. It's one of the more reliable things I know about you.",
    understandingIds: ['und_sleep', 'und_energy'],
  },
  {
    id: 'disc_late_cycle_recovery',
    name: 'Late Cycle Recovery',
    discoveredAt: 'July 3, 2026',
    confidence: 58,
    confidenceLabel: 'Medium',
    narrative: 'Your recovery tends to dip slightly in the days before your period starts.',
    detail:
      "I've noticed this in the last 3 cycles. I'd like to see a few more before I'm fully confident.",
    understandingIds: ['und_cycle', 'und_recovery'],
  },
];


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
