import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, type } from '../../theme/tokens';
import PrimaryButton from '../../components/PrimaryButton';
import GhostButton from '../../components/GhostButton';
import Card from '../../components/Card';
import { signIn, signUp } from '../../lib/auth';
import { seedProfileName } from '../../lib/socialAuth';
import SocialAuthButtons from '../../components/SocialAuthButtons';
import { connectHealthConnect, requestHealthConnectPermission } from '../../lib/healthConnect';
import { connectHealthKit, requestHealthKitPermission } from '../../lib/healthKit';
import ConversationOnboarding, { type ConversationSummary } from './ConversationOnboarding';
import KeyboardAvoidingScreen from '../../components/KeyboardAvoidingScreen';
import {
  ONBOARDING_ACCOUNT_STEP,
  ONBOARDING_CONVERSATION_STEP,
  ONBOARDING_FLOW_STEPS,
  type OnboardingAnswer,
} from '../../lib/onboardingConversation';
import {
  loadGuestOnboardingDraft,
  saveGuestOnboardingDraft,
  type GuestOnboardingDraft,
} from '../../lib/onboardingDraft';

const TOTAL_STEPS = ONBOARDING_FLOW_STEPS.length;

const ACCOUNT_STEP = ONBOARDING_ACCOUNT_STEP;
const CONVERSATION_STEP = ONBOARDING_CONVERSATION_STEP;

// The one welcome screen shown after the splash, before the conversation.
const WELCOME_SLIDE = {
  title: 'Welcome to Ciatta.',
  body: 'Every body tells a story. Over time, an understanding of yours takes shape, so you can make sense of what changes.',
};

export interface OnboardingDraft {
  name: string;
  dob: string;
  lifeStage: string | null;
  story: string | null;
  notifPref: string;
  sharedHealthRows: string[];
  height: string;
  weight: string;
  answers: OnboardingAnswer[];
  needsCommit: boolean;
  connectHealthAfterAuth: boolean;
}

const HEALTH_SOURCE_NAME = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';
const HEALTH_SOURCE_BODY =
  Platform.OS === 'android'
    ? 'Health Connect brings in your sleep, activity, and heart health without asking you the same questions twice.'
    : 'Apple Health brings in your sleep, activity, and heart health without asking you the same questions twice.';

export default function OnboardingFlow({
  onComplete,
  startStep = 0,
  userId,
}: {
  onComplete: (draft: OnboardingDraft) => void;
  startStep?: number;
  userId?: string;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(startStep);
  const fade = useRef(new Animated.Value(1)).current;

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [lifeStage, setLifeStage] = useState<string | null>(null);
  const [story, setStory] = useState<string | null>(null);
  const [concern, setConcern] = useState<string | null>(null);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [answers, setAnswers] = useState<OnboardingAnswer[]>([]);
  const [needsCommit, setNeedsCommit] = useState(false);
  const [conversationDone, setConversationDone] = useState(false);
  const [connectHealthAfterAuth, setConnectHealthAfterAuth] = useState(false);
  const [appleHealthConnected, setAppleHealthConnected] = useState(false);
  const [healthConnecting, setHealthConnecting] = useState(false);
  const [healthConnectNote, setHealthConnectNote] = useState<string | null>(null);

  function buildDraft(healthAfterAuth = connectHealthAfterAuth): OnboardingDraft {
    return {
      name,
      dob,
      lifeStage,
      story,
      notifPref: 'discoveries',
      sharedHealthRows: ['cycle', 'medical', 'meds'],
      height,
      weight,
      answers,
      needsCommit,
      connectHealthAfterAuth: healthAfterAuth,
    };
  }

  function snapshotGuestDraft(
    nextStep: number,
    conversationDone: boolean,
    extra: Partial<GuestOnboardingDraft> = {}
  ) {
    if (userId) return;
    const snapshot: GuestOnboardingDraft = {
      name,
      dob,
      lifeStage,
      story,
      concern,
      height,
      weight,
      answers,
      connectHealthAfterAuth,
      conversationDone,
      needsCommit: true,
      step: nextStep,
      ...extra,
    };
    saveGuestOnboardingDraft(snapshot).catch(() => {});
  }

  useEffect(() => {
    if (userId) return;
    let cancelled = false;
    loadGuestOnboardingDraft().then((saved) => {
      if (cancelled || !saved) return;
      setName(saved.name);
      setDob(saved.dob);
      setLifeStage(saved.lifeStage);
      setStory(saved.story);
      setConcern(saved.concern);
      setHeight(saved.height);
      setWeight(saved.weight);
      setAnswers(saved.answers);
      setNeedsCommit(saved.needsCommit);
      setConversationDone(saved.conversationDone);
      setConnectHealthAfterAuth(saved.connectHealthAfterAuth);
      if (typeof saved.step === 'number' && saved.step > 0) {
        setStep(saved.step);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Onboarding no longer asks a separate "which categories can I share"
  // question — the conversation itself asks about cycle/medical history/
  // medications directly, so reaching this step already means all three
  // were discussed (answered or explicitly declined) rather than merely
  // permitted in the abstract.
  function finishOnboarding(healthAfterAuth = connectHealthAfterAuth) {
    onComplete(buildDraft(healthAfterAuth));
  }

  function proceedAfterUnderstanding(healthAfterAuth = connectHealthAfterAuth) {
    if (userId) {
      finishOnboarding(healthAfterAuth);
      return;
    }
    snapshotGuestDraft(ACCOUNT_STEP, true, { connectHealthAfterAuth: healthAfterAuth });
    goTo(ACCOUNT_STEP);
  }

  async function handleConnectHealthSource() {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      setAppleHealthConnected(true);
      proceedAfterUnderstanding(true);
      return;
    }
    if (!userId) {
      setHealthConnecting(true);
      setHealthConnectNote(null);
      try {
        const result =
          Platform.OS === 'android'
            ? await requestHealthConnectPermission()
            : await requestHealthKitPermission();
        if (result.granted) {
          setAppleHealthConnected(true);
          setConnectHealthAfterAuth(true);
          proceedAfterUnderstanding(true);
        } else if (result.reason === 'unavailable') {
          setHealthConnectNote(
            Platform.OS === 'android'
              ? "Health Connect isn't installed on this device yet. Install it from the Play Store, then come back and connect."
              : "Apple Health isn't available on this device."
          );
        } else {
          setHealthConnectNote(
            "Permission wasn't granted to read your health data. You can try again or continue without it for now."
          );
        }
      } catch (e) {
        setHealthConnectNote(
          e instanceof Error ? e.message : `Something went wrong connecting ${HEALTH_SOURCE_NAME}.`
        );
      } finally {
        setHealthConnecting(false);
      }
      return;
    }
    setHealthConnecting(true);
    setHealthConnectNote(null);
    try {
      const result =
        Platform.OS === 'android'
          ? await connectHealthConnect(userId)
          : await connectHealthKit(userId);
      if (result.granted) {
        setAppleHealthConnected(true);
        finishOnboarding(false);
      } else if (result.reason === 'unavailable') {
        setHealthConnectNote(
          Platform.OS === 'android'
            ? "Health Connect isn't installed on this device yet. Install it from the Play Store, then come back and connect."
            : "Apple Health isn't available on this device."
        );
      } else {
        setHealthConnectNote(
          "Permission wasn't granted to read your health data. You can try again or continue without it for now."
        );
      }
    } catch (e) {
      setHealthConnectNote(
        e instanceof Error ? e.message : `Something went wrong connecting ${HEALTH_SOURCE_NAME}.`
      );
    } finally {
      setHealthConnecting(false);
    }
  }

  function handleConversationDone(summary: ConversationSummary) {
    setName(summary.name);
    setDob(summary.dob);
    setLifeStage(summary.lifeStage || null);
    setHeight(summary.height);
    setWeight(summary.weight);
    setStory(summary.intent);
    setConcern(summary.concern);
    setAnswers(summary.answers);
    setNeedsCommit(summary.needsCommit);
    setConversationDone(true);
    snapshotGuestDraft(step + 1, true, {
      name: summary.name,
      dob: summary.dob,
      lifeStage: summary.lifeStage || null,
      height: summary.height,
      weight: summary.weight,
      story: summary.intent,
      concern: summary.concern,
      answers: summary.answers,
      needsCommit: summary.needsCommit,
    });
    next();
  }

  function goTo(next: number) {
    Animated.timing(fade, { toValue: 0, duration: 130, useNativeDriver: true }).start(
      () => {
        setStep(next);
        Animated.timing(fade, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );
  }

  const next = () => goTo(step + 1);
  const back = () => step > 0 && goTo(step - 1);
  const skipToAccount = () => goTo(ACCOUNT_STEP);

  const dark = DARK_STEPS.has(step);

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: dark ? colors.dark : colors.canvas },
      ]}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && styles.dotActive,
                i !== step && (dark ? styles.dotInactiveDark : styles.dotInactiveLight),
              ]}
            />
          ))}
        </View>
        {step > 0 ? (
          <Pressable onPress={back} hitSlop={10}>
            <Text style={[styles.back, dark && { color: 'rgba(255,255,255,0.7)' }]}>
              Back
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      <KeyboardAvoidingScreen>
      <Animated.View style={[styles.body, { opacity: fade, paddingBottom: insets.bottom + 24 }]}>
        {step === 0 && (
          <Message
            title={WELCOME_SLIDE.title}
            body={WELCOME_SLIDE.body}
            ctaLabel="Begin"
            onContinue={next}
            secondaryLabel="Already have an account? Sign in"
            onSecondary={skipToAccount}
          />
        )}

        {step === CONVERSATION_STEP && (
          <ConversationOnboarding userId={userId} onDone={handleConversationDone} />
        )}

        {step === 2 && <BeginningYourStory onDone={next} />}

        {step === 3 && (
          <Reflection
            name={name}
            lifeStage={lifeStage}
            story={story}
            concern={concern}
            healthSourceName={HEALTH_SOURCE_NAME}
            healthSourceBody={HEALTH_SOURCE_BODY}
            healthConnecting={healthConnecting}
            healthConnectNote={healthConnectNote}
            appleHealthConnected={appleHealthConnected}
            onConnectHealth={handleConnectHealthSource}
            onSkipHealth={() => proceedAfterUnderstanding(false)}
          />
        )}

        {step === ACCOUNT_STEP && (
          <AccountStep
            onAuthed={() => {
              if (conversationDone) {
                finishOnboarding();
              } else {
                goTo(CONVERSATION_STEP);
              }
            }}
          />
        )}
      </Animated.View>
      </KeyboardAvoidingScreen>
    </View>
  );
}

// Every screen now uses the light canvas — the dark-step treatment was
// dropped on request. The `dark` branches below are kept (inert) so the
// treatment can be reinstated per-step by re-adding indices here.
const DARK_STEPS = new Set<number>([]);

function BeginningYourStory({ onDone }: { onDone: () => void }) {
  const lines = ['Your understanding', 'is beginning.'];
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 900,
      delay: 300,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [opacity, onDone]);

  return (
    <View style={[styles.flex, { alignItems: 'center', justifyContent: 'center' }]}>
      <Animated.View style={{ opacity, alignItems: 'center' }}>
        <View style={styles.pulseBox} />
        <Text style={styles.beginningTitle}>
          {lines[0]}
          {'\n'}
          {lines[1]}
        </Text>
        <Text style={styles.beginningCaption}>Just a moment.</Text>
      </Animated.View>
    </View>
  );
}

// Merges what used to be two separate screens (a fake "here's what I know"
// card, and a bare health-connect step) into one honest close: what the
// conversation actually collected, then what Ciatta has actually observed
// so far — which, before Apple Health/Health Connect is connected, is
// nothing, and says so rather than inventing a claim to fill the space.
function Reflection({
  name,
  lifeStage,
  story,
  concern,
  healthSourceName,
  healthSourceBody,
  healthConnecting,
  healthConnectNote,
  appleHealthConnected,
  onConnectHealth,
  onSkipHealth,
}: {
  name: string;
  lifeStage: string | null;
  story: string | null;
  concern: string | null;
  healthSourceName: string;
  healthSourceBody: string;
  healthConnecting: boolean;
  healthConnectNote: string | null;
  appleHealthConnected: boolean;
  onConnectHealth: () => void;
  onSkipHealth: () => void;
}) {
  const told: string[] = [];
  if (name.trim()) told.push(`Your name is ${name.trim()}.`);
  if (lifeStage) told.push(`You're in ${lifeStage.toLowerCase()}.`);
  if (story) told.push(story);
  if (concern && concern !== "I'm not sure yet") told.push(`Right now: ${concern.toLowerCase()}.`);

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>What's taking{'\n'}shape so far.</Text>
      <Text style={styles.subtitle}>
        A quick honest look: what you shared, and what has actually
        been observed so far.
      </Text>

      <Card style={{ marginTop: 24 }}>
        <Text style={styles.rightNowLabel}>WHAT YOU SHARED</Text>
        {told.length > 0 ? (
          told.map((line, i) => (
            <Text key={i} style={[styles.rightNowText, i > 0 && { marginTop: 8 }]}>
              {line}
            </Text>
          ))
        ) : (
          <Text style={styles.rightNowText}>Nothing yet. We'll pick this up as we go.</Text>
        )}

        <View style={styles.rightNowDivider} />

        <Text style={styles.rightNowLabel}>WHAT'S BEEN OBSERVED</Text>
        <Text style={styles.rightNowSub}>
          Nothing yet. There isn't any of your body's data here. Once there is,
          real patterns can take shape instead of only what you share.
        </Text>
      </Card>

      <Text style={[styles.subtitle, { marginTop: 24 }]}>{healthSourceBody}</Text>
      {healthConnectNote ? (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.authError}>{healthConnectNote}</Text>
          {healthConnectNote.startsWith("Health Connect isn't installed") && (
            <GhostButton
              label="Open Play Store"
              tone="ink"
              onPress={() =>
                Linking.openURL(
                  'market://details?id=com.google.android.apps.healthdata'
                ).catch(() =>
                  Linking.openURL(
                    'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'
                  )
                )
              }
            />
          )}
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <PrimaryButton
        label={appleHealthConnected ? 'Connected' : `Connect ${healthSourceName}`}
        onPress={onConnectHealth}
        loading={healthConnecting}
        disabled={appleHealthConnected}
      />
      <GhostButton label="I'll do this later" onPress={onSkipHealth} />
    </View>
  );
}

function AccountStep({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        const result = await signUp(email.trim(), password);
        if (result.session) {
          onAuthed();
        } else {
          setNeedsConfirmation(true);
        }
      } else {
        await signIn(email.trim(), password);
        onAuthed();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmedContinue() {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      onAuthed();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "That didn't work yet. Try again once you've confirmed."
      );
    } finally {
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <View style={styles.flex}>
        <Text style={styles.title}>Check your email.</Text>
        <Text style={styles.subtitle}>
          A confirmation link is on its way to {email}. Once you've confirmed, come
          back here to continue.
        </Text>
        {error ? <Text style={styles.authError}>{error}</Text> : null}
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="I've confirmed. Continue"
          onPress={handleConfirmedContinue}
          loading={loading}
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>
        {mode === 'signup' ? 'Create your account.' : 'Welcome back.'}
      </Text>
      <Text style={styles.subtitle}>
        {mode === 'signup'
          ? 'This is where your understanding will live, and only you can access it.'
          : 'Sign in to pick up where you left off.'}
      </Text>

      <SocialAuthButtons
        onAuthed={(fullName) => {
          setError(null);
          if (fullName) {
            // Apple hands the name over exactly once, on first authorization —
            // capture it now or it's gone for good.
            seedProfileName(fullName).catch(() => {});
          }
          onAuthed();
        }}
        onError={setError}
      />

      <Text style={styles.fieldLabel}>EMAIL</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={colors.ink3}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <Text style={styles.fieldLabel}>PASSWORD</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
        placeholderTextColor={colors.ink3}
        style={styles.input}
        secureTextEntry
        autoComplete="password"
      />

      {error ? <Text style={styles.authError}>{error}</Text> : null}

      <View style={{ flex: 1 }} />
      <PrimaryButton
        label={mode === 'signup' ? 'Create account' : 'Sign in'}
        onPress={handleSubmit}
        loading={loading}
        disabled={!email.trim() || password.length < 6}
      />
      <GhostButton
        label={
          mode === 'signup'
            ? 'Already have an account? Sign in'
            : 'New here? Create an account'
        }
        onPress={() => {
          setError(null);
          setMode((m) => (m === 'signup' ? 'signin' : 'signup'));
        }}
      />
    </View>
  );
}

function Message({
  dark,
  title,
  body,
  ctaLabel,
  onContinue,
  secondaryLabel,
  onSecondary,
}: {
  dark?: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  onContinue: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.flex}>
      <Text style={[styles.messageTitle, dark && { color: colors.white }]}>{title}</Text>
      <Text style={[styles.messageBody, dark && { color: 'rgba(255,255,255,0.75)' }]}>
        {body}
      </Text>
      <View style={{ flex: 1 }} />
      <PrimaryButton label={ctaLabel} onPress={onContinue} />
      {secondaryLabel && onSecondary ? (
        <GhostButton label={secondaryLabel} onPress={onSecondary} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.accent,
  },
  dotInactiveLight: {
    backgroundColor: colors.border,
  },
  dotInactiveDark: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  back: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.ink2,
  },
  body: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 20,
  },

  messageTitle: {
    ...type.title1,
    color: colors.ink,
    marginTop: 12,
  },
  messageBody: {
    ...fonts.sans,
    fontSize: 15.5,
    lineHeight: 23,
    color: colors.ink2,
    marginTop: 18,
  },

  title: {
    ...type.title1,
    color: colors.ink,
    marginTop: 8,
  },
  subtitle: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 10,
  },
  fieldLabel: {
    ...fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
    marginTop: 22,
    marginBottom: 8,
  },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    ...fonts.sans,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 10,
  },
  authError: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 16,
  },
  pulseBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    marginBottom: 28,
  },
  beginningTitle: {
    ...type.title1,
    color: colors.ink,
    textAlign: 'center',
  },
  beginningCaption: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.ink3,
    marginTop: 16,
  },

  rightNowLabel: {
    ...fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
    marginBottom: 8,
  },
  rightNowText: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink,
  },
  rightNowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  rightNowSub: {
    ...fonts.sans,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.ink2,
  },
});
