import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts, radii } from '../../theme/tokens';
import { answerCuriosity, fetchNextOnboardingQuestion, type ActiveCuriosity } from '../../lib/curiosity';
import { classifyHealthIntent } from '../../lib/healthIntent';
import { withClockSkewRetry } from '../../lib/sessionGuard';
import { ArrowUpIcon, MicIcon } from '../../components/icons';

// Tags whose answers get run through the health-domain classifier — the
// open "what would you like me to understand" question and its free-text
// elaboration, the two places language actually varies enough to be worth
// classifying. Chip-only backbone questions (medications, life stage, ...)
// don't need it; their structure already says what they mean.
const CLASSIFIED_TAGS = new Set(['concern', 'concern_elaborate']);

const LIFE_STAGES = ['Reproductive Years', 'Perimenopause', 'Menopause', 'Postmenopause'];

// The five baseline-identity questions the conversation always opens with —
// "Who am I? / Where am I physiologically?" from the spec. Kept as a fixed
// local sequence rather than curiosity_bank rows because they need
// dedicated input types (free text, chips) the bank's chip-or-text model
// isn't built to distinguish that finely, and because they map straight to
// existing profile columns rather than becoming Observations. Everything
// after this (why-are-you-here onward) is adaptive, server-decided, and
// driven entirely by next_onboarding_question().
type IdentityField = 'name' | 'dob' | 'lifeStage' | 'height' | 'weight';

interface IdentityQuestion {
  field: IdentityField;
  prompt: string;
  placeholder: string;
  chips?: string[];
}

const IDENTITY_QUESTIONS: IdentityQuestion[] = [
  { field: 'name', prompt: 'What should I call you?', placeholder: 'Jennifer' },
  { field: 'dob', prompt: 'When were you born?', placeholder: 'mm/dd/yyyy' },
  {
    field: 'lifeStage',
    prompt: 'Where are you in your reproductive journey?',
    placeholder: '',
    chips: LIFE_STAGES,
  },
  { field: 'height', prompt: "What's your height?", placeholder: 'e.g. 5\'6" or 165 cm' },
  { field: 'weight', prompt: "What's your weight?", placeholder: 'e.g. 140 lb or 64 kg' },
];

export interface ConversationSummary {
  name: string;
  dob: string;
  lifeStage: string;
  height: string;
  weight: string;
  // First chip picked for tag 'intent' and 'concern' — the two answers the
  // reflection screen quotes back as "what you told me."
  intent: string | null;
  concern: string | null;
}

// One question lives on screen at a time — no scrolling transcript. Keying
// the card on a fresh identifier for every question (rather than mutating
// one persistent view) is what makes the old question disappear completely
// and the new one reveal in exactly the same position, using the same
// fade + slide the old chat bubbles used, just without a history trailing
// behind it.
function QuestionCard({ text, purpose, thinking }: { text: string; purpose?: string; thinking?: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay: 60,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const style = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };

  return (
    <Animated.View style={[styles.ciattaRow, style]}>
      <View style={styles.ciattaMark} />
      <View style={styles.ciattaBubble}>
        {thinking ? (
          <Text style={styles.thinking}>···</Text>
        ) : (
          <>
            <Text style={styles.ciattaText}>{text}</Text>
            {purpose ? <Text style={styles.ciattaPurpose}>{purpose}</Text> : null}
          </>
        )}
      </View>
    </Animated.View>
  );
}

// The composer is a single rounded field, not a text box with a separate
// button beside it: empty shows a mic (tapping it just focuses the field —
// there's no speech-to-text wired up yet, so this never pretends to listen)
// and typing morphs that same trailing slot into Send, in place.
function Composer({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  autoCapitalize,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  autoCapitalize?: 'words' | 'sentences' | 'none' | 'characters';
}) {
  const inputRef = useRef<TextInput>(null);
  const hasText = value.trim().length > 0;

  return (
    <View style={styles.composer}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        style={styles.composerInput}
        onSubmitEditing={onSubmit}
        returnKeyType="send"
        autoCapitalize={autoCapitalize}
      />
      <Pressable
        onPress={hasText ? onSubmit : () => inputRef.current?.focus()}
        style={({ pressed }) => [
          styles.composerAction,
          hasText && styles.composerActionActive,
          pressed && { opacity: 0.85 },
        ]}
      >
        {hasText ? <ArrowUpIcon size={16} color={colors.white} /> : <MicIcon size={16} color={colors.ink3} />}
      </Pressable>
    </View>
  );
}

export default function ConversationOnboarding({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (summary: ConversationSummary) => void;
}) {
  const [identityIndex, setIdentityIndex] = useState(0);
  const [activeCuriosity, setActiveCuriosity] = useState<ActiveCuriosity | null>(null);
  const [phase, setPhase] = useState<'identity' | 'adaptive' | 'loading' | 'done'>('identity');
  const [inputValue, setInputValue] = useState('');
  const [preferTyping, setPreferTyping] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // What loadNextAdaptiveQuestion was called with, so "Try again" can
  // re-issue the exact same call after a failure instead of losing it.
  const lastCallRef = useRef<{ tag?: string; answer?: string }>({});

  const draft = useRef<ConversationSummary>({
    name: '',
    dob: '',
    lifeStage: '',
    height: '',
    weight: '',
    intent: null,
    concern: null,
  });

  const currentIdentityQuestion =
    phase === 'identity' ? IDENTITY_QUESTIONS[identityIndex] : null;

  async function loadNextAdaptiveQuestion(lastTag?: string, lastAnswer?: string) {
    lastCallRef.current = { tag: lastTag, answer: lastAnswer };
    setLoadError(null);
    setPhase('loading');
    // A PGRST303 (JWT issued at future) here gets the same one
    // refresh-and-retry treatment as the main data load — see
    // sessionGuard.ts. Anything else, including a failed retry, falls
    // through to the catch below instead of crashing the conversation.
    try {
      const next = await withClockSkewRetry(
        () => fetchNextOnboardingQuestion(userId, lastTag, lastAnswer),
        'onboarding conversation'
      );
      if (!next) {
        setPhase('done');
        onDone(draft.current);
        return;
      }
      setActiveCuriosity(next);
      setPreferTyping(false);
      setPhase('adaptive');
    } catch (e) {
      console.error('Could not load the next onboarding question:', e);
      setLoadError("I couldn't quite catch that — check your connection and try again.");
      setPhase('adaptive');
    }
  }

  function submitIdentityAnswer(rawValue: string) {
    const value = rawValue.trim();
    if (!value || !currentIdentityQuestion) return;
    draft.current = { ...draft.current, [currentIdentityQuestion.field]: value };
    setInputValue('');
    setPreferTyping(false);
    if (identityIndex + 1 < IDENTITY_QUESTIONS.length) {
      setIdentityIndex((i) => i + 1);
    } else {
      loadNextAdaptiveQuestion();
    }
  }

  async function submitAdaptiveAnswer(rawValue: string) {
    const value = rawValue.trim();
    if (!value || !activeCuriosity) return;
    const answeredCuriosity = activeCuriosity;
    if (answeredCuriosity.tag === 'intent') draft.current.intent = value;
    if (answeredCuriosity.tag === 'concern') draft.current.concern = value;
    setInputValue('');
    setLoadError(null);
    const tag = answeredCuriosity.tag;
    setActiveCuriosity(null);
    // The health-domain taxonomy never reaches the UI — it's computed here,
    // behind the scenes, purely as provenance on the Observation.
    const extraContext =
      tag && CLASSIFIED_TAGS.has(tag) ? { health_domains: classifyHealthIntent(value) } : {};
    try {
      await withClockSkewRetry(
        () => answerCuriosity(userId, answeredCuriosity, value, extraContext),
        'onboarding answer'
      );
    } catch (e) {
      console.error('Could not save that answer:', e);
      // Restore the question so the same chips/text box reappear — nothing
      // was actually saved, so nothing else should move forward either.
      setActiveCuriosity(answeredCuriosity);
      setLoadError("That didn't save — check your connection and try again.");
      return;
    }
    await loadNextAdaptiveQuestion(tag, value);
  }

  function submitTextInput() {
    if (phase === 'identity') submitIdentityAnswer(inputValue);
    else if (phase === 'adaptive') submitAdaptiveAnswer(inputValue);
  }

  const chips = currentIdentityQuestion?.chips ?? activeCuriosity?.answerOptions ?? [];
  const showChips = chips.length > 0 && !preferTyping;
  const showTextInput =
    phase === 'identity'
      ? !currentIdentityQuestion?.chips || preferTyping
      : phase === 'adaptive' &&
        !!activeCuriosity &&
        (!activeCuriosity.answerOptions.length || preferTyping);

  // Keyed on the question's own identity (not an index into a list) so a
  // new key = a new QuestionCard instance = the old one is genuinely gone,
  // not just relabeled — that's what makes it "disappear completely."
  const questionKey =
    phase === 'loading'
      ? 'loading'
      : phase === 'identity'
      ? `identity-${identityIndex}`
      : activeCuriosity
      ? `adaptive-${activeCuriosity.id}`
      : 'done';
  const questionText =
    phase === 'identity' ? currentIdentityQuestion?.prompt ?? '' : activeCuriosity?.question ?? '';
  const questionPurpose = phase === 'adaptive' ? activeCuriosity?.purpose : undefined;

  // No KeyboardAvoidingView here — the parent OnboardingFlow already wraps
  // its whole body in one (the app-wide KeyboardAvoidingScreen), and this
  // component is only ever mounted inside that. A second one nested inside
  // the first would double-compensate for the keyboard height.
  return (
    <View style={styles.flex}>
      <View style={styles.questionArea}>
        {questionKey !== 'done' && (
          <QuestionCard
            key={questionKey}
            text={questionText}
            purpose={questionPurpose}
            thinking={phase === 'loading'}
          />
        )}
      </View>

      <View style={styles.inputArea}>
        {loadError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{loadError}</Text>
            {/* Only offered when there's nothing left on screen to retry by
                re-tapping — a failed answer-save instead restores its
                question's chips/text box, which is already the retry. */}
            {!activeCuriosity && phase !== 'identity' && (
              <Pressable
                onPress={() => loadNextAdaptiveQuestion(lastCallRef.current.tag, lastCallRef.current.answer)}
                hitSlop={8}
              >
                <Text style={styles.retryLink}>Try again</Text>
              </Pressable>
            )}
          </View>
        )}
        {showChips && (
          <>
            <View style={styles.chipGrid}>
              {chips.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() =>
                    phase === 'identity' ? submitIdentityAnswer(opt) : submitAdaptiveAnswer(opt)
                  }
                  style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.chipText}>{opt}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setPreferTyping(true)} hitSlop={8}>
              <Text style={styles.typeInsteadLink}>Prefer to type your own answer?</Text>
            </Pressable>
          </>
        )}
        {showTextInput && (
          <Composer
            value={inputValue}
            onChangeText={setInputValue}
            onSubmit={submitTextInput}
            placeholder={currentIdentityQuestion?.placeholder ?? 'Type your answer'}
            autoCapitalize={currentIdentityQuestion?.field === 'name' ? 'words' : 'sentences'}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  questionArea: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  ciattaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    maxWidth: '92%',
  },
  ciattaMark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  ciattaBubble: {
    flex: 1,
  },
  ciattaText: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
  },
  ciattaPurpose: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink3,
    marginTop: 6,
  },
  thinking: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.ink3,
  },
  inputArea: {
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  errorBox: {
    marginBottom: 12,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
  },
  retryLink: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  typeInsteadLink: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink3,
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
  },
  composerInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 8,
  },
  composerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerActionActive: {
    backgroundColor: colors.accent,
  },
});
