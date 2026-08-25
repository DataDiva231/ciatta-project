// Care Preparation — assembles an already-computed Understanding into
// something a user can bring to a provider conversation. This is
// deliberately a pure read-side aggregation, not a new stored artifact:
// everything it prints already lives on the Understanding row and its
// history (narrative, evidence counts, still-learning questions, Guidance)
// — the same fields UnderstandingSheet already renders, just reformatted
// as plain text instead of styled views. Nothing here infers, summarizes,
// or adds a claim that wasn't already shown on screen.
//
// The one new fact this produces (that a brief was prepared, and when) is
// recorded the same way every other user action already is — as a manual
// Observation — rather than a bespoke "visit prep" table. See
// UnderstandingSheet's use of insertObservation after a successful share.

export interface VisitBriefProvider {
  name: string;
  specialty: string | null;
  address: string | null;
  phone: string | null;
}

export interface VisitBriefInput {
  domainLabel: string;
  narrative: string;
  confidenceLabel: string;
  observationsCount: number;
  learningSpan: string | null;
  timelineSteps: { label: string; detail: string }[];
  stillLearning: string[];
  guidance: string | null;
  // Optional — set only when the user picked a result from Provider
  // Search (see ProviderSearchSheet) before preparing this brief. Never
  // required: a brief with no provider attached is just as valid, since
  // Care Preparation and Provider Search are separate steps in the chain.
  provider?: VisitBriefProvider | null;
}

export function buildVisitBrief(input: VisitBriefInput): string {
  const lines: string[] = [];
  lines.push(`Ciatta summary — ${input.domainLabel}`);
  lines.push('');

  if (input.provider) {
    lines.push('WHO YOU\'RE SEEING');
    lines.push(
      input.provider.specialty ? `${input.provider.name} — ${input.provider.specialty}` : input.provider.name
    );
    if (input.provider.address) lines.push(input.provider.address);
    if (input.provider.phone) lines.push(input.provider.phone);
    lines.push('');
  }

  lines.push('WHAT CIATTA UNDERSTANDS');
  lines.push(input.narrative);
  lines.push('');

  lines.push('EVIDENCE');
  lines.push(
    `${input.observationsCount} reading${input.observationsCount === 1 ? '' : 's'}` +
      (input.learningSpan ? `, over ${input.learningSpan}` : '') +
      `. Confidence: ${input.confidenceLabel}.`
  );
  lines.push('');

  if (input.timelineSteps.length > 0) {
    lines.push('WHEN THIS CHANGED');
    for (const step of input.timelineSteps) {
      lines.push(`${step.label} — ${step.detail}`);
    }
    lines.push('');
  }

  const questions = [...input.stillLearning];
  if (questions.length > 0) {
    lines.push('QUESTIONS TO CONSIDER');
    for (const q of questions) lines.push(`- ${q}`);
    lines.push('');
  }

  if (input.guidance) {
    lines.push('WORTH DISCUSSING');
    lines.push(input.guidance);
    lines.push('');
  }

  lines.push(
    'Prepared by Ciatta from this user’s own recorded observations. This is not a diagnosis.'
  );

  return lines.join('\n');
}
