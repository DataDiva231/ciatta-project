// Ciatta's health-intelligence framework — a lightweight, rules-based
// classifier that maps free-form language onto the broader set of clinical
// domains Ciatta pays attention to. This never reaches the UI: the
// conversation only ever asks in plain language ("What would you like me
// to understand about you?", "Tell me a little more"). This module is what
// turns an answer like "I keep waking up at 3am" into structured,
// provenance-tagged signal behind the scenes — attached to the resulting
// Observation's context for future intelligence work to draw on, not used
// to gate or label anything the user sees.
//
// It is intentionally not diagnostic: matching a domain here means "this
// answer touched on this area of the body," nothing more. No condition is
// inferred, and an answer matching zero domains (most short answers) is a
// completely normal, expected outcome — the conversation still proceeds.

export interface HealthDomainDef {
  key: string;
  label: string;
  keywords: string[];
}

export const HEALTH_DOMAINS: HealthDomainDef[] = [
  { key: 'reproductive_hormonal', label: 'Reproductive & hormonal', keywords: ['hormone', 'hormonal', 'period', 'cycle', 'pms', 'pmdd', 'estrogen', 'progesterone', 'testosterone', 'ovulat'] },
  { key: 'sleep', label: 'Sleep', keywords: ['sleep', 'insomnia', 'waking up', 'wake up', 'woke up', 'awake', 'nap', 'snor'] },
  { key: 'cardiovascular', label: 'Cardiovascular', keywords: ['heart', 'blood pressure', 'palpitation', 'chest pain', 'cholesterol', 'circulation'] },
  { key: 'metabolic', label: 'Metabolic', keywords: ['weight', 'blood sugar', 'glucose', 'insulin', 'metaboli', 'diabetes'] },
  { key: 'immune_autoimmune', label: 'Immune & autoimmune', keywords: ['immune', 'autoimmune', 'lupus', 'rheumatoid', 'inflammation', 'allergy', 'allergies'] },
  { key: 'bone_musculoskeletal', label: 'Bone & musculoskeletal', keywords: ['joint', 'bone', 'muscle', 'back pain', 'arthritis', 'osteoporosis', 'stiff'] },
  { key: 'neurological_cognitive', label: 'Neurological & cognitive', keywords: ['brain fog', 'memory', 'focus', 'headache', 'migraine', 'concentrat', 'dizzy'] },
  { key: 'mental_emotional', label: 'Mental & emotional', keywords: ['anxious', 'anxiety', 'depress', 'mood', 'stress', 'overwhelm', 'not feeling like myself', 'emotional'] },
  { key: 'gastrointestinal', label: 'Gastrointestinal', keywords: ['stomach', 'bloat', 'digest', 'gut', 'ibs', 'nausea', 'constipat', 'diarrhea'] },
  { key: 'thyroid_endocrine', label: 'Thyroid & endocrine', keywords: ['thyroid', 'hashimoto', 'hypothyroid', 'hyperthyroid'] },
  { key: 'breast', label: 'Breast', keywords: ['breast', 'mammogram', 'lump'] },
  { key: 'gynecological', label: 'Gynecological', keywords: ['vaginal', 'discharge', 'fibroid', 'endometriosis', 'pcos', 'pelvic'] },
  { key: 'sexual', label: 'Sexual health', keywords: ['libido', 'sex drive', 'intimacy', 'sexual'] },
  { key: 'pregnancy_postpartum', label: 'Pregnancy & postpartum', keywords: ['pregnan', 'postpartum', 'breastfeed', 'trying to conceive', 'fertility'] },
  { key: 'menopause_midlife', label: 'Menopause & midlife', keywords: ['menopause', 'perimenopause', 'hot flash', 'night sweat', 'midlife'] },
  { key: 'chronic_conditions', label: 'Chronic conditions', keywords: ['chronic', 'condition', 'diagnosed', 'managing my', 'flare'] },
  { key: 'cancer_prevention', label: 'Cancer & prevention', keywords: ['cancer', 'screening', 'biopsy', 'tumor'] },
  { key: 'kidney_urinary', label: 'Kidney & urinary', keywords: ['kidney', 'bladder', 'uti', 'urinary', 'urinat'] },
  { key: 'dermatological', label: 'Dermatological', keywords: ['skin', 'acne', 'rash', 'eczema', 'psoriasis', 'hair loss'] },
  { key: 'nutrition', label: 'Nutrition', keywords: ['diet', 'eating', 'nutrition', 'appetite'] },
  { key: 'energy_recovery', label: 'Energy & recovery', keywords: ['energy', 'fatigue', 'exhaust', 'recover', 'burnt out', 'burn out'] },
  { key: 'aging_longevity', label: 'Aging & longevity', keywords: ['aging', 'longevity', 'getting older', 'healthspan'] },
  { key: 'medication_supplement', label: 'Medication & supplement', keywords: ['medication', 'supplement', 'prescri'] },
];

/**
 * Best-effort, case-insensitive keyword scan — not NLP, just enough to give
 * an Observation useful provenance and (later) route intelligence work.
 * Returns [] when nothing recognizable matched, which is expected for most
 * short answers and never blocks the conversation from continuing.
 */
export function classifyHealthIntent(text: string): string[] {
  const lower = text.toLowerCase();
  const matches: string[] = [];
  for (const domain of HEALTH_DOMAINS) {
    if (domain.keywords.some((kw) => lower.includes(kw))) {
      matches.push(domain.key);
    }
  }
  return matches;
}
