export type Domain = 'sleep' | 'recovery' | 'energy' | 'cycle' | 'mood';

export type Strength = 'very-strong' | 'strong' | 'moderate' | 'emerging';

export interface RelationshipRef {
  domain: Domain;
  strength: Strength;
}

export interface HistoryStep {
  date: string;
  label: string;
  active?: boolean;
}

export interface Understanding {
  id: string;
  domain: Domain;
  strength: Strength;
  observations: number;
  learningSince: string;
  firstObserved: string;
  lastUpdated: string;
  confidence: string;
  narrative: string;
  history: HistoryStep[];
  stillLearning: string[];
  relationships: RelationshipRef[];
}

export interface Discovery {
  id: string;
  name: string;
  discoveredAt: string;
  confidence: number;
  confidenceLabel: string;
  narrative: string;
  detail: string;
  understandingIds: string[];
}

export interface EvidenceRow {
  label: string;
  value: string;
  context: string;
  direction: 'up' | 'down' | 'flat';
}

export interface ConnectionItem {
  id: string;
  label: string;
  status: 'connected' | 'coming-soon' | 'not-connected';
}

export interface HealthItem {
  id: string;
  label: string;
  value: string;
}

export interface Profile {
  id: string;
  name: string | null;
  preferred_name: string | null;
  dob: string | null;
  pronouns: string | null;
  life_stage: string | null;
  location: string | null;
  about: string | null;
  goals: string[];
  notification_preference: string;
  shared_health_rows: string[];
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfileDraft = Partial<
  Pick<
    Profile,
    | 'name'
    | 'preferred_name'
    | 'dob'
    | 'life_stage'
    | 'about'
    | 'goals'
    | 'notification_preference'
    | 'shared_health_rows'
    | 'onboarded_at'
  >
>;
