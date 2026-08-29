// onboardingConversation.ts is plain TypeScript (no React Native imports),
// so it's runnable directly under Deno — same pattern as visitPrep.test.ts.
// Run with:
//   deno test src/lib/onboardingConversation.test.ts
import { assertEquals } from 'jsr:@std/assert@1';
import {
  commitOnboardingAnswers,
  extraContextForOnboardingAnswer,
  ONBOARDING_ACCOUNT_STEP,
  ONBOARDING_CONVERSATION_STEP,
  ONBOARDING_FLOW_STEPS,
  pickNextOnboardingQuestion,
  recordOnboardingAnswer,
  type OnboardingAnswer,
  type OnboardingBankRow,
} from './onboardingConversation.ts';
import type { Domain } from './types.ts';

function row(
  partial: Partial<OnboardingBankRow> & Pick<OnboardingBankRow, 'tag' | 'question'>
): OnboardingBankRow {
  return {
    purpose: 'purpose',
    domain: 'recovery' as Domain,
    answer_options: [],
    observation_type: partial.tag,
    input_kind: 'chip',
    depends_on_tag: null,
    depends_on_answer_contains: null,
    depends_on_answer_not_contains: null,
    active: true,
    is_onboarding: true,
    ...partial,
  };
}

// Mirrors the live onboarding bank after 20260825000000_health_intent_conversation.sql
const BANK: OnboardingBankRow[] = [
  row({
    tag: 'intent',
    question: 'What brings you here?',
    domain: 'energy' as Domain,
    observation_type: 'primary_intent',
  }),
  row({
    tag: 'concern',
    question: "What's on your mind about your body?",
    domain: 'energy' as Domain,
    observation_type: 'health_concern',
    answer_options: ["I'm not sure yet"],
  }),
  row({
    tag: 'medications',
    question: 'Are you currently taking any medications?',
    observation_type: 'medications',
    input_kind: 'text',
  }),
  row({
    tag: 'supplements',
    question: 'What about supplements?',
    observation_type: 'supplements',
    input_kind: 'text',
  }),
  row({
    tag: 'health_history',
    question: 'Is there any health history or condition that belongs here?',
    observation_type: 'health_history',
    input_kind: 'text',
  }),
  row({
    tag: 'concern_elaborate',
    question: "A little more, in your own words. What's changed?",
    observation_type: 'health_concern_detail',
    input_kind: 'text',
    depends_on_tag: 'concern',
    depends_on_answer_not_contains: 'not sure',
  }),
  row({
    tag: 'concern_recency',
    question: 'Has this been happening recently, or has it been going on for a while?',
    observation_type: 'health_concern_recency',
    depends_on_tag: 'concern_elaborate',
  }),
  row({
    tag: 'concern_cycle_followup',
    question: 'Are your cycles fairly regular, or do they vary a lot?',
    domain: 'cycle' as Domain,
    active: false,
    depends_on_tag: 'concern',
    depends_on_answer_contains: 'cycle',
  }),
];

function walk(answers: { tag: string; answer: string }[]): string[] {
  const asked: string[] = [];
  let lastTag: string | undefined;
  let lastAnswer: string | undefined;
  const tags: string[] = [];
  for (;;) {
    const next = pickNextOnboardingQuestion(BANK, asked, lastTag, lastAnswer);
    if (!next) break;
    tags.push(next.tag);
    const given = answers.find((a) => a.tag === next.tag);
    if (!given) break;
    asked.push(next.tag);
    lastTag = next.tag;
    lastAnswer = given.answer;
  }
  return tags;
}

Deno.test('onboarding flow order: authentication is the last step, after understanding', () => {
  assertEquals(ONBOARDING_FLOW_STEPS[0], 'welcome');
  assertEquals(ONBOARDING_FLOW_STEPS[ONBOARDING_CONVERSATION_STEP], 'conversation');
  assertEquals(ONBOARDING_FLOW_STEPS[ONBOARDING_ACCOUNT_STEP], 'account');
  assertEquals(ONBOARDING_ACCOUNT_STEP, ONBOARDING_FLOW_STEPS.length - 1);
  assertEquals(ONBOARDING_ACCOUNT_STEP > ONBOARDING_CONVERSATION_STEP, true);
});

Deno.test('pickNextOnboardingQuestion: conversation opens on intent', () => {
  const next = pickNextOnboardingQuestion(BANK, []);
  assertEquals(next?.tag, 'intent');
});

Deno.test('pickNextOnboardingQuestion: backbone proceeds intent → concern → medications when concern is declined', () => {
  const tags = walk([
    { tag: 'intent', answer: 'I simply want to understand my body better.' },
    { tag: 'concern', answer: "I'm not sure yet" },
    { tag: 'medications', answer: 'None right now' },
    { tag: 'supplements', answer: 'None right now' },
    { tag: 'health_history', answer: 'Nothing to add' },
  ]);
  assertEquals(tags, ['intent', 'concern', 'medications', 'supplements', 'health_history']);
});

Deno.test('pickNextOnboardingQuestion: a real concern unlocks elaborate then recency before the backbone resumes', () => {
  const tags = walk([
    { tag: 'intent', answer: 'I want to understand my energy.' },
    { tag: 'concern', answer: 'Something has changed' },
    { tag: 'concern_elaborate', answer: 'I keep waking up at 3am' },
    { tag: 'concern_recency', answer: 'Just recently' },
    { tag: 'medications', answer: 'None right now' },
    { tag: 'supplements', answer: 'None right now' },
    { tag: 'health_history', answer: 'Nothing to add' },
  ]);
  assertEquals(tags, [
    'intent',
    'concern',
    'concern_elaborate',
    'concern_recency',
    'medications',
    'supplements',
    'health_history',
  ]);
});

Deno.test('pickNextOnboardingQuestion: deactivated domain follow-ups never surface', () => {
  const next = pickNextOnboardingQuestion(
    BANK,
    ['intent'],
    'concern',
    'My cycle has been irregular'
  );
  assertEquals(next?.tag, 'concern_elaborate');
});

Deno.test('pickNextOnboardingQuestion: returns null once every backbone tag is asked and no follow-up remains', () => {
  const next = pickNextOnboardingQuestion(
    BANK,
    ['intent', 'concern', 'medications', 'supplements', 'health_history'],
    'health_history',
    'Nothing to add'
  );
  assertEquals(next, null);
});

Deno.test('extraContextForOnboardingAnswer: classified tags attach health_domains, others do not', () => {
  const classified = extraContextForOnboardingAnswer('concern', 'I keep waking up at 3am');
  assertEquals(Array.isArray(classified.health_domains), true);
  assertEquals((classified.health_domains as string[]).includes('sleep'), true);
  assertEquals(extraContextForOnboardingAnswer('medications', 'None right now'), {});
});

Deno.test('commitOnboardingAnswers: replays guest answers through fetch-then-answer, then stops', async () => {
  const inserted: string[] = [];
  const answered: { tag: string; answer: string }[] = [];
  const queue: OnboardingBankRow[] = [
    BANK[0],
    BANK[1],
    BANK.find((r) => r.tag === 'concern_elaborate')!,
  ];
  let i = 0;

  const fetchNext = async () => {
    const row = queue[i++];
    if (!row) return null;
    inserted.push(row.tag);
    return {
      id: `id-${row.tag}`,
      question: row.question,
      purpose: row.purpose,
      domain: row.domain,
      answerOptions: row.answer_options,
      observationType: row.observation_type,
      tag: row.tag,
      inputKind: row.input_kind,
    };
  };

  const answers: OnboardingAnswer[] = [
    recordOnboardingAnswer('intent', 'I want to understand my energy.'),
    recordOnboardingAnswer('concern', 'Something has changed'),
    recordOnboardingAnswer('concern_elaborate', 'I keep waking up at 3am'),
  ];

  await commitOnboardingAnswers('user-1', answers, {
    fetchNext,
    answer: async (_userId, curiosity, answer) => {
      answered.push({ tag: curiosity.tag ?? '', answer });
    },
  });

  assertEquals(inserted, ['intent', 'concern', 'concern_elaborate']);
  assertEquals(
    answered.map((a) => a.tag),
    ['intent', 'concern', 'concern_elaborate']
  );
  assertEquals(answered[2].answer, 'I keep waking up at 3am');
});

Deno.test('commitOnboardingAnswers: writes nothing when there are no guest answers', async () => {
  let fetches = 0;
  await commitOnboardingAnswers('user-1', [], {
    fetchNext: async () => {
      fetches += 1;
      return null;
    },
    answer: async () => {
      throw new Error('should not answer');
    },
  });
  assertEquals(fetches, 0);
});
