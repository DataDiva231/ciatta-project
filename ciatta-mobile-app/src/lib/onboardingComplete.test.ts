// Integration tests for the unauthenticated-onboarding → auth → app handoff.
// Plain TypeScript (no React Native) so Deno can run them with the rest of
// the client suite. Run with:
//   deno test --sloppy-imports src/lib/onboardingComplete.test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  ONBOARDING_ACCOUNT_STEP,
  ONBOARDING_CONVERSATION_STEP,
  ONBOARDING_FLOW_STEPS,
  pickNextOnboardingQuestion,
  recordOnboardingAnswer,
  type OnboardingAnswer,
  type OnboardingBankRow,
  type PreviewCuriosity,
} from './onboardingConversation.ts';
import {
  afterAccountAuth,
  completeOnboardingAfterAuth,
  type OnboardingCompleteDraft,
} from './onboardingComplete.ts';
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
];

function collectGuestAnswers(
  replies: Record<string, string>
): OnboardingAnswer[] {
  const asked: string[] = [];
  const answers: OnboardingAnswer[] = [];
  let lastTag: string | undefined;
  let lastAnswer: string | undefined;
  for (;;) {
    const next = pickNextOnboardingQuestion(BANK, asked, lastTag, lastAnswer);
    if (!next) break;
    const reply = replies[next.tag];
    if (!reply) break;
    asked.push(next.tag);
    answers.push(recordOnboardingAnswer(next.tag, reply));
    lastTag = next.tag;
    lastAnswer = reply;
  }
  return answers;
}

const FRESH_REPLIES = {
  intent: 'I want to understand my energy.',
  concern: 'Something has changed',
  concern_elaborate: 'I keep waking up at 3am',
  concern_recency: 'Just recently',
  medications: 'None right now',
  supplements: 'None right now',
  health_history: 'Nothing to add',
};

function guestDraft(
  extra: Partial<OnboardingCompleteDraft> = {}
): OnboardingCompleteDraft {
  return {
    name: 'Jenny',
    dob: '01/15/1985',
    lifeStage: 'Perimenopause',
    story: 'I want to understand my energy.',
    notifPref: 'discoveries',
    sharedHealthRows: ['cycle', 'medical', 'meds'],
    height: `5'6"`,
    weight: '140 lb',
    answers: collectGuestAnswers(FRESH_REPLIES),
    needsCommit: true,
    connectHealthAfterAuth: false,
    ...extra,
  };
}

interface FakeAccount {
  onboarded_at: string | null;
  profile: Record<string, unknown>;
  observations: { userId: string; type: string; answer: string; extra: Record<string, unknown> }[];
  guestDraft: OnboardingCompleteDraft | 'present' | null;
  healthSyncedFor: string | null;
  loadedFor: string | null;
  log: string[];
}

function createFake(onboarded: boolean) {
  const queued: string[] = [];
  const state: FakeAccount = {
    onboarded_at: onboarded ? '2026-01-01T00:00:00.000Z' : null,
    profile: onboarded ? { name: 'Existing' } : {},
    observations: [],
    guestDraft: 'present',
    healthSyncedFor: null,
    loadedFor: null,
    log: [],
  };

  const deps = {
    fetchProfile: async () => ({ onboarded_at: state.onboarded_at }),
    updateProfile: async (_userId: string, patch: Record<string, unknown>) => {
      state.log.push('updateProfile');
      state.profile = { ...state.profile, ...patch };
      state.onboarded_at = (patch.onboarded_at as string) ?? state.onboarded_at;
      return { onboarded_at: state.onboarded_at };
    },
    fetchNext: async (
      _userId: string,
      lastTag?: string,
      lastAnswer?: string
    ): Promise<PreviewCuriosity | null> => {
      const next = pickNextOnboardingQuestion(BANK, queued, lastTag, lastAnswer);
      if (!next) return null;
      queued.push(next.tag);
      return {
        id: `id-${next.tag}`,
        question: next.question,
        purpose: next.purpose,
        domain: next.domain,
        answerOptions: next.answer_options,
        observationType: next.observation_type,
        tag: next.tag,
        inputKind: next.input_kind,
      } satisfies PreviewCuriosity;
    },
    answer: async (
      userId: string,
      curiosity: PreviewCuriosity,
      answer: string,
      extraContext: Record<string, unknown> = {}
    ) => {
      state.log.push(`answer:${curiosity.tag}`);
      state.observations.push({
        userId,
        type: curiosity.observationType,
        answer,
        extra: extraContext,
      });
    },
    syncHealth: async (userId: string) => {
      state.log.push('syncHealth');
      state.healthSyncedFor = userId;
      state.observations.push({
        userId,
        type: 'steps',
        answer: 'health-sync',
        extra: {},
      });
    },
    clearGuestDraft: async () => {
      state.log.push('clearGuestDraft');
      state.guestDraft = null;
    },
    loadUserData: async (userId: string) => {
      state.log.push('loadUserData');
      state.loadedFor = userId;
    },
  };

  return { state, deps };
}

Deno.test('flow: account is after conversation and reflection, not before', () => {
  assertEquals(ONBOARDING_FLOW_STEPS[ONBOARDING_CONVERSATION_STEP], 'conversation');
  assertEquals(ONBOARDING_FLOW_STEPS[3], 'reflection');
  assertEquals(ONBOARDING_FLOW_STEPS[ONBOARDING_ACCOUNT_STEP], 'account');
  assert(ONBOARDING_ACCOUNT_STEP > 3);
  assertEquals(afterAccountAuth(true), 'persist');
  assertEquals(afterAccountAuth(false), 'continue-conversation');
});

Deno.test('fresh user: onboarding → reflection → account creation persists context and opens Today/Core', async () => {
  const { state, deps } = createFake(false);
  const draft = guestDraft();
  assertEquals(draft.answers.map((a) => a.tag), [
    'intent',
    'concern',
    'concern_elaborate',
    'concern_recency',
    'medications',
    'supplements',
    'health_history',
  ]);
  assertEquals(state.observations.length, 0);

  const result = await completeOnboardingAfterAuth('user-fresh', draft, deps);

  assertEquals(result.status, 'onboarded');
  assertEquals(state.onboarded_at !== null, true);
  assertEquals(state.profile.name, 'Jenny');
  assertEquals(state.profile.life_stage, 'Perimenopause');
  assertEquals(state.observations.length, 7);
  assertEquals(
    state.observations.map((o) => o.type),
    [
      'primary_intent',
      'health_concern',
      'health_concern_detail',
      'health_concern_recency',
      'medications',
      'supplements',
      'health_history',
    ]
  );
  const concern = state.observations.find((o) => o.type === 'health_concern');
  assertEquals((concern?.extra.health_domains as string[]).includes('sleep'), false);
  const elaborate = state.observations.find((o) => o.type === 'health_concern_detail');
  assertEquals((elaborate?.extra.health_domains as string[]).includes('sleep'), true);
  assertEquals(state.guestDraft, null);
  assertEquals(state.loadedFor, 'user-fresh');
  assertEquals(state.healthSyncedFor, null);
  assertEquals(state.log[state.log.length - 1], 'loadUserData');
  assert(state.log.indexOf('updateProfile') < state.log.indexOf('loadUserData'));
});

Deno.test('returning user: Sign in on an existing account loads that account and does not re-onboard', async () => {
  const { state, deps } = createFake(true);
  const result = await completeOnboardingAfterAuth('user-returning', guestDraft(), deps);

  assertEquals(afterAccountAuth(false), 'continue-conversation');
  assertEquals(result.status, 'entered-existing-account');
  assertEquals(state.observations.length, 0);
  assertEquals(state.profile.name, 'Existing');
  assertEquals(state.onboarded_at, '2026-01-01T00:00:00.000Z');
  assertEquals(state.guestDraft, null);
  assertEquals(state.loadedFor, 'user-returning');
  assertEquals(state.log.includes('updateProfile'), false);
  assertEquals(state.healthSyncedFor, null);
});

Deno.test('guest onboarding: health permission does not persist data until after account creation', async () => {
  const { state, deps } = createFake(false);
  const draft = guestDraft({ connectHealthAfterAuth: true });
  assertEquals(state.observations.length, 0);
  assertEquals(state.healthSyncedFor, null);

  const result = await completeOnboardingAfterAuth('user-health', draft, deps);

  assertEquals(result.status, 'onboarded');
  assertEquals(state.healthSyncedFor, 'user-health');
  assert(state.observations.some((o) => o.type === 'health_concern'));
  assert(state.observations.some((o) => o.type === 'steps' && o.answer === 'health-sync'));
  const commitIdx = state.log.indexOf('answer:intent');
  const healthIdx = state.log.indexOf('syncHealth');
  const loadIdx = state.log.indexOf('loadUserData');
  assert(commitIdx >= 0 && healthIdx > commitIdx && loadIdx > healthIdx);
});

Deno.test('guest draft is discarded when signing into an already-onboarded account', async () => {
  const { state, deps } = createFake(true);
  const draft = guestDraft({
    name: 'Guest Name',
    answers: [recordOnboardingAnswer('medications', 'Secret medication')],
    connectHealthAfterAuth: true,
  });

  const result = await completeOnboardingAfterAuth('user-onboarded', draft, deps);

  assertEquals(result.status, 'entered-existing-account');
  assertEquals(state.guestDraft, null);
  assertEquals(state.observations.length, 0);
  assertEquals(state.profile.name, 'Existing');
  assertEquals(state.healthSyncedFor, null);
  assertEquals(state.log.includes('updateProfile'), false);
});
