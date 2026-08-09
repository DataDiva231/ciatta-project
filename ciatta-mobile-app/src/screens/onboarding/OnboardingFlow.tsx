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
import { colors, fonts, radii } from '../../theme/tokens';
import PrimaryButton from '../../components/PrimaryButton';
import GhostButton from '../../components/GhostButton';
import Card from '../../components/Card';
import { signIn, signUp } from '../../lib/auth';
import { connectHealthConnect } from '../../lib/healthConnect';
import { connectHealthKit } from '../../lib/healthKit';

const TOTAL_STEPS = 12;

export interface OnboardingDraft {
  name: string;
  dob: string;
  lifeStage: string | null;
  story: string | null;
  notifPref: string;
  sharedHealthRows: string[];
}

const LIFE_STAGES = ['Reproductive Years', 'Perimenopause', 'Menopause', 'Postmenopause'];
const STORY_OPTIONS = [
  'I want to understand my energy.',
  'I want to understand my cycle.',
  "I'm preparing for pregnancy.",
  "I'm entering menopause.",
  'I simply want to understand my body better.',
];
const NOTIF_OPTIONS = [
  { id: 'discoveries', title: 'Only discoveries', sub: 'The most meaningful moments.' },
  { id: 'important', title: 'Important understandings', sub: 'When something shifts significantly.' },
  { id: 'curiosity', title: 'Curiosity', sub: 'When I have a question for you.' },
  { id: 'nothing', title: 'Nothing for now', sub: "I'll check in on my own." },
];
const HEALTH_ROWS = [
  { id: 'cycle', title: 'Cycle history', sub: 'Helps me understand your patterns.' },
  { id: 'medical', title: 'Medical history', sub: 'Important context for understanding.' },
  { id: 'meds', title: 'Medications & supplements', sub: 'These can affect how your body responds.' },
];

const HEALTH_SOURCE_NAME = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';
const HEALTH_SOURCE_BODY =
  Platform.OS === 'android'
    ? 'Health Connect helps me understand your sleep, activity, and heart health without asking you the same questions twice.'
    : 'Apple Health helps me understand your sleep, activity, and heart health without asking you the same questions twice.';

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
  const [notifPref, setNotifPref] = useState('discoveries');
  const [sharedHealthRows, setSharedHealthRows] = useState<string[]>([]);
  const [appleHealthConnected, setAppleHealthConnected] = useState(false);
  const [healthConnecting, setHealthConnecting] = useState(false);
  const [healthConnectNote, setHealthConnectNote] = useState<string | null>(null);
  const [arcConnected, setArcConnected] = useState(false);

  async function handleConnectHealthSource() {
    if (!userId || (Platform.OS !== 'android' && Platform.OS !== 'ios')) {
      setAppleHealthConnected(true);
      next();
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
        next();
      } else if (result.reason === 'unavailable') {
        setHealthConnectNote(
          Platform.OS === 'android'
            ? "Health Connect isn't installed on this device yet. Install it from the Play Store, then come back and connect."
            : "Apple Health isn't available on this device."
        );
      } else {
        setHealthConnectNote(
          "I wasn't given permission to read your health data. You can try again or continue without it for now."
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

  function toggleHealthRow(id: string) {
    setSharedHealthRows((rows) =>
      rows.includes(id) ? rows.filter((r) => r !== id) : [...rows, id]
    );
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

      <Animated.View style={[styles.body, { opacity: fade, paddingBottom: insets.bottom + 24 }]}>
        {step === 0 && (
          <Message
            dark
            title="Welcome to Ciatta."
            body="Every body tells a story. I'm here to spend time understanding yours."
            ctaLabel="Begin"
            onContinue={next}
          />
        )}

        {step === 1 && (
          <Message
            dark
            title="Understanding takes time."
            body="I don't make assumptions. I learn through conversations, evidence, and your everyday life. My understanding grows with you.

Every once in a while, I'll discover something meaningful about your biology. Those discoveries become part of the story we build together."
            ctaLabel="Continue"
            onContinue={next}
          />
        )}

        {step === 2 && (
          <Message
            title="Your understanding belongs to you."
            body="I only ask for what helps me understand you better.

Your information is protected and private.

Permissions can always be changed."
            ctaLabel="I understand"
            onContinue={next}
          />
        )}

        {step === 3 && <AccountStep onAuthed={next} />}

        {step === 4 && (
          <View style={styles.flex}>
            <Text style={styles.title}>A little about you.</Text>
            <Text style={styles.subtitle}>This helps me understand you from the start.</Text>

            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Jennifer"
              placeholderTextColor={colors.ink3}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
            <TextInput
              value={dob}
              onChangeText={setDob}
              placeholder="mm/dd/yyyy"
              placeholderTextColor={colors.ink3}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>LIFE STAGE</Text>
            <View style={styles.grid2}>
              {LIFE_STAGES.map((ls) => (
                <Pressable
                  key={ls}
                  onPress={() => setLifeStage(ls)}
                  style={[styles.chip, lifeStage === ls && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      lifeStage === ls && styles.chipTextActive,
                    ]}
                  >
                    {ls}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flex: 1 }} />
            <PrimaryButton
              label="Continue"
              onPress={next}
              disabled={!name.trim() || !lifeStage}
            />
          </View>
        )}

        {step === 5 && (
          <View style={styles.flex}>
            <Text style={styles.title}>What brings{'\n'}you here?</Text>
            <Text style={styles.subtitle}>Choose what feels most true right now.</Text>
            <View style={{ marginTop: 24, gap: 12 }}>
              {STORY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setStory(opt)}
                  style={[styles.optionRow, story === opt && styles.optionRowActive]}
                >
                  <Text style={styles.optionRowText}>{opt}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Continue" onPress={next} />
          </View>
        )}

        {step === 6 && (
          <View style={styles.flex}>
            <Text style={styles.title}>A little about{'\n'}your health.</Text>
            <Text style={styles.subtitle}>
              Only what's relevant. This helps me make meaningful connections.
            </Text>
            <View style={{ marginTop: 24, gap: 12 }}>
              {HEALTH_ROWS.map((row) => {
                const selected = sharedHealthRows.includes(row.id);
                return (
                  <Pressable
                    key={row.id}
                    onPress={() => toggleHealthRow(row.id)}
                    style={[styles.healthRow, selected && styles.healthRowActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionRowText}>{row.title}</Text>
                      <Text style={styles.optionRowSub}>{row.sub}</Text>
                    </View>
                    <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                      {selected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Continue" onPress={next} />
            <GhostButton label="Skip for now" onPress={next} />
          </View>
        )}

        {step === 7 && (
          <View style={styles.flex}>
            <Text style={styles.title}>Let me remember{'\n'}what your body{'\n'}already knows.</Text>
            <Text style={styles.subtitle}>{HEALTH_SOURCE_BODY}</Text>
            {healthConnectNote ? (
              <View style={{ marginTop: 20 }}>
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
              label={appleHealthConnected ? 'Connected' : `Connect ${HEALTH_SOURCE_NAME}`}
              onPress={handleConnectHealthSource}
              loading={healthConnecting}
              disabled={appleHealthConnected}
            />
            <GhostButton label="Maybe later" onPress={next} />
          </View>
        )}

        {step === 8 && (
          <View style={styles.flex}>
            <Text style={styles.brand}>CIATTA</Text>
            <Text style={styles.arcTitle}>Meet Arc.</Text>
            <Text style={styles.arcBody}>
              Arc quietly listens to your physiology throughout the day.
              Together, we'll notice patterns neither of us could discover
              alone.
            </Text>
            <View style={styles.arcOrb}>
              <View style={styles.arcOrbInner} />
              <View style={styles.arcOrbCore} />
            </View>
            <View style={{ flex: 1 }} />
            <PrimaryButton
              label="Connect Arc"
              onPress={() => {
                setArcConnected(true);
                next();
              }}
            />
            <GhostButton label="I'll do this later" onPress={next} tone="light" />
          </View>
        )}

        {step === 9 && (
          <View style={styles.flex}>
            <Text style={styles.title}>When should{'\n'}I reach out?</Text>
            <Text style={styles.subtitle}>
              I only reach out when I think something is worth your attention.
            </Text>
            <View style={{ marginTop: 24, gap: 12 }}>
              {NOTIF_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => setNotifPref(opt.id)}
                  style={[
                    styles.notifRow,
                    notifPref === opt.id && styles.notifRowActive,
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      notifPref === opt.id && styles.radioActive,
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionRowText}>{opt.title}</Text>
                    <Text style={styles.optionRowSub}>{opt.sub}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Continue" onPress={next} />
          </View>
        )}

        {step === 10 && <BeginningYourStory onDone={next} />}

        {step === 11 && (
          <View style={styles.flex}>
            <Text style={styles.title}>Here's what{'\n'}I know so far.</Text>
            <Text style={styles.subtitle}>
              Right now, my understanding is just beginning. As we spend more
              time together, I'll become more confident.
            </Text>
            <Card style={{ marginTop: 28 }}>
              <Text style={styles.rightNowLabel}>RIGHT NOW</Text>
              <Text style={styles.rightNowText}>
                Based on the information you've shared, recovery may become an
                important part of your story.
              </Text>
              <View style={styles.rightNowDivider} />
              <Text style={styles.rightNowLabel}>STILL LEARNING</Text>
              <Text style={styles.rightNowSub}>
                I'm just getting to know you. I'll become more confident over
                time.
              </Text>
            </Card>
            <View style={{ flex: 1 }} />
            <PrimaryButton
              label="Continue to Today"
              onPress={() =>
                onComplete({ name, dob, lifeStage, story, notifPref, sharedHealthRows })
              }
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const DARK_STEPS = new Set([0, 1, 8]);

function BeginningYourStory({ onDone }: { onDone: () => void }) {
  const lines = ["I'm beginning to", 'understand you.'];
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
          : "That didn't work yet — try again once you've confirmed."
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
          I've sent a confirmation link to {email}. Once you've confirmed, come
          back here to continue.
        </Text>
        {error ? <Text style={styles.authError}>{error}</Text> : null}
        <View style={{ flex: 1 }} />
        <PrimaryButton
          label="I've confirmed — Continue"
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
}: {
  dark?: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  onContinue: () => void;
}) {
  return (
    <View style={styles.flex}>
      <Text style={[styles.messageTitle, dark && { color: colors.white }]}>{title}</Text>
      <Text style={[styles.messageBody, dark && { color: 'rgba(255,255,255,0.75)' }]}>
        {body}
      </Text>
      <View style={{ flex: 1 }} />
      <PrimaryButton label={ctaLabel} onPress={onContinue} />
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
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink2,
  },
  body: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 20,
  },

  messageTitle: {
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    color: colors.ink,
    marginTop: 12,
  },
  messageBody: {
    fontFamily: fonts.sans,
    fontSize: 15.5,
    lineHeight: 23,
    color: colors.ink2,
    marginTop: 18,
  },

  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    color: colors.ink,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 10,
  },
  fieldLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
    marginTop: 22,
    marginBottom: 8,
  },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 10,
  },
  authError: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 16,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '47%',
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.accent,
  },

  optionRow: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
  },
  optionRowActive: {
    borderColor: colors.accent,
  },
  optionRowText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink,
  },
  optionRowSub: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink2,
    marginTop: 4,
  },

  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
  },
  healthRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkmark: {
    color: colors.white,
    fontSize: 12,
    fontFamily: fonts.sansMedium,
  },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
  },
  notifRowActive: {
    borderColor: colors.accent,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 2,
  },
  radioActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },

  brand: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  arcTitle: {
    fontFamily: fonts.serif,
    fontSize: 32,
    color: colors.white,
    marginTop: 20,
  },
  arcBody: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 12,
    maxWidth: '92%',
  },
  arcOrb: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(242,106,83,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
  },
  arcOrbInner: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(242,106,83,0.22)',
  },
  arcOrbCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
  },

  pulseBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    marginBottom: 28,
  },
  beginningTitle: {
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    color: colors.ink,
    textAlign: 'center',
  },
  beginningCaption: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink3,
    marginTop: 16,
  },

  rightNowLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
    marginBottom: 8,
  },
  rightNowText: {
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.ink2,
  },
});
