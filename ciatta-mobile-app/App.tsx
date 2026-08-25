import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from '@expo-google-fonts/karla';
import { Karla_400Regular, Karla_500Medium, Karla_600SemiBold } from '@expo-google-fonts/karla';
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_500Medium_Italic,
} from '@expo-google-fonts/fraunces';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import type { Session } from '@supabase/supabase-js';

import { colors, fonts as fontTokens } from './src/theme/tokens';
import { supabase } from './src/lib/supabase';
import { signOut } from './src/lib/auth';
import { isAuthFailure } from './src/lib/errors';
import { isClockSkewError, logSessionClockSkew, withClockSkewRetry } from './src/lib/sessionGuard';
import { fetchProfile, updateProfile } from './src/lib/profile';
import {
  fetchCrossDomainUnderstandings,
  fetchDiscoveries,
  fetchRelationships,
  fetchUnderstandingHistory,
  fetchUnderstandings,
  hasHealthSourceObservations,
  nameDiscovery,
  type CrossDomainUnderstandingRow,
  type DiscoveryRow,
  type RelationshipRow,
  type UnderstandingHistoryRow,
  type UnderstandingRow,
} from './src/lib/queries';
import { answerCuriosity, fetchActiveCuriosity, type ActiveCuriosity } from './src/lib/curiosity';
import {
  fetchLastHealthSyncAt,
  fetchProviderFeedback,
  fetchRecentSyncSummary,
  type ProviderFeedbackRow,
  type RecentSyncSummary,
} from './src/lib/observations';
import { registerForPush } from './src/lib/notifications';
import { connectHealthConnect } from './src/lib/healthConnect';
import { connectHealthKit } from './src/lib/healthKit';
import type { Domain, Profile, Strength } from './src/lib/types';

import OnboardingFlow, {
  type OnboardingDraft,
} from './src/screens/onboarding/OnboardingFlow';
import TodayScreen from './src/screens/TodayScreen';
import CoreScreen from './src/screens/CoreScreen';
import YouScreen from './src/screens/YouScreen';
import BottomNav, { MainTab } from './src/components/BottomNav';

import UnderstandingSheet from './src/overlays/UnderstandingSheet';
import TodayInfoSheet from './src/overlays/TodayInfoSheet';
import CuriosityOverlay from './src/overlays/CuriosityOverlay';
import DiscoveryFlow from './src/overlays/DiscoveryFlow';
import DiscoveryDetailSheet from './src/overlays/DiscoveryDetailSheet';
import DataPrivacySheet from './src/overlays/DataPrivacySheet';
import HealthSyncSheet from './src/overlays/HealthSyncSheet';
import ProfileEditSheet, { PROFILE_FIELDS } from './src/overlays/ProfileEditSheet';
import HealthNoteSheet, { isHealthNoteRow } from './src/overlays/HealthNoteSheet';
import BottomSheet from './src/components/BottomSheet';
import PrimaryButton from './src/components/PrimaryButton';
import AnimatedSplash from './src/components/AnimatedSplash';

SplashScreen.preventAutoHideAsync().catch(() => {});

const AUTO_SYNC_COOLDOWN_MS = 60 * 60 * 1000;

function parseDob(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// The conversation collects height/weight as free text ("5'6\"", "165 cm",
// "140 lb", "64 kg") rather than a constrained input, since forcing a unit
// picker onto a chat bubble would break the conversational feel. These are
// a best-effort parse into the columns' fixed units (cm / kg); an answer
// that doesn't match anything recognizable is stored as null rather than
// guessed at, since a wrong biometric is worse than a missing one.
function parseHeightToCm(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const feetInches = s.match(/^(\d+)\s*(?:'|ft)\s*(\d+)?\s*(?:"|in)?$/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = Number(feetInches[2] ?? 0);
    return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
  }

  const cm = s.match(/^(\d+(?:\.\d+)?)\s*cm$/);
  if (cm) return Number(cm[1]);

  const inOnly = s.match(/^(\d+(?:\.\d+)?)\s*(?:in|inches)$/);
  if (inOnly) return Math.round(Number(inOnly[1]) * 2.54 * 10) / 10;

  // A bare number is assumed to already be centimeters — the only unit a
  // typical height (100-230) and this range don't collide with.
  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const n = Number(bare[1]);
    return n >= 100 && n <= 230 ? n : null;
  }

  return null;
}

function parseWeightToKg(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  const lb = s.match(/^(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)$/);
  if (lb) return Math.round(Number(lb[1]) * 0.453592 * 10) / 10;

  const kg = s.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)$/);
  if (kg) return Number(kg[1]);

  // A bare number: kg and lb ranges overlap for adults, so this leans on
  // the more common case (lb) once above a kg-implausible threshold.
  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const n = Number(bare[1]);
    if (n > 160) return Math.round(n * 0.453592 * 10) / 10;
    if (n > 0) return n;
  }

  return null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Karla_400Regular,
    Karla_500Medium,
    Karla_600SemiBold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_500Medium_Italic,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [understandings, setUnderstandings] = useState<UnderstandingRow[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [understandingHistory, setUnderstandingHistory] = useState<UnderstandingHistoryRow[]>([]);
  const [crossDomainUnderstandings, setCrossDomainUnderstandings] = useState<
    CrossDomainUnderstandingRow[]
  >([]);
  const [providerFeedback, setProviderFeedback] = useState<ProviderFeedbackRow[]>([]);
  const [discoveries, setDiscoveries] = useState<DiscoveryRow[]>([]);
  const [activeCuriosity, setActiveCuriosity] = useState<ActiveCuriosity | null>(null);
  const [healthSourceConnected, setHealthSourceConnected] = useState(false);
  const [recentSyncSummary, setRecentSyncSummary] = useState<RecentSyncSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [tab, setTab] = useState<MainTab>('today');
  const [understandingDomain, setUnderstandingDomain] = useState<Domain | null>(null);
  const [curiosityVisible, setCuriosityVisible] = useState(false);
  const [todayInfoVisible, setTodayInfoVisible] = useState(false);
  const [discoveryFlowVisible, setDiscoveryFlowVisible] = useState(false);
  const [selectedDiscoveryId, setSelectedDiscoveryId] = useState<string | null>(null);
  const [dataPrivacyVisible, setDataPrivacyVisible] = useState(false);
  const [healthSyncVisible, setHealthSyncVisible] = useState(false);
  const [rowSheet, setRowSheet] = useState<{ section: string; row: string } | null>(
    null
  );
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [healthNoteRowId, setHealthNoteRowId] = useState<string | null>(null);

  const pendingDiscovery = discoveries.find((d) => d.status === 'pending') ?? null;
  const selectedDiscovery = discoveries.find((d) => d.id === selectedDiscoveryId) ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      logSessionClockSkew(data.session?.access_token, 'getSession (restart/persisted)');
      setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      logSessionClockSkew(s?.access_token, `onAuthStateChange (${event})`);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Auto-sync replaces having to find the manual "Sync now" button — if
  // Health Connect/HealthKit is already connected and it's been a while
  // since the last sync, quietly pull fresh data whenever the app is
  // opened. requestPermission/requestAuthorization only prompt the OS
  // dialog the first time (or if access was revoked), so this is silent on
  // every normal open. Failures are swallowed — this is a background
  // nicety, not a user-facing action, so it never surfaces an error; the
  // manual sync sheet remains the fallback with real error messaging.
  //
  // Guarded against re-entrancy: Android's AppState can emit several rapid
  // 'active' transitions around a single cold start (window-focus churn,
  // not real background/foreground cycles), which would otherwise fire this
  // multiple times concurrently — wasteful, and if permission were ever not
  // already granted, capable of popping the OS consent dialog more than
  // once.
  const autoSyncInFlightRef = useRef(false);
  const maybeAutoSync = useCallback(async (userId: string) => {
    if (autoSyncInFlightRef.current) return;
    autoSyncInFlightRef.current = true;
    try {
      const lastSyncedAt = await fetchLastHealthSyncAt(userId);
      const due =
        !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > AUTO_SYNC_COOLDOWN_MS;
      if (!due) return;
      const result =
        Platform.OS === 'android' ? await connectHealthConnect(userId) : await connectHealthKit(userId);
      if (result.granted) {
        setRecentSyncSummary(await fetchRecentSyncSummary(userId));
      }
    } catch {
      // Silent by design — see comment above.
    } finally {
      autoSyncInFlightRef.current = false;
    }
  }, []);

  const loadUserData = useCallback(
    async (userId: string) => {
      setDataLoading(true);
      setLoadError(null);
      try {
        // PGRST303 ("JWT issued at future") gets one refresh-and-retry of
        // the whole batch before it's treated as a real failure — see
        // sessionGuard.ts. Everything else (network drop, a genuinely dead
        // session) passes straight through to the catch below unchanged.
        const [p, u, r, h, cd, pf, d, c, hc, sync] = await withClockSkewRetry(
          () =>
            Promise.all([
              fetchProfile(userId),
              fetchUnderstandings(userId),
              fetchRelationships(userId),
              fetchUnderstandingHistory(userId),
              fetchCrossDomainUnderstandings(userId),
              fetchProviderFeedback(userId),
              fetchDiscoveries(userId),
              fetchActiveCuriosity(userId),
              hasHealthSourceObservations(userId),
              fetchRecentSyncSummary(userId),
            ]),
          'loadUserData'
        );
        setProfile(p);
        setUnderstandings(u);
        setRelationships(r);
        setUnderstandingHistory(h);
        setCrossDomainUnderstandings(cd);
        setProviderFeedback(pf);
        setDiscoveries(d);
        setActiveCuriosity(c);
        setHealthSourceConnected(hc);
        setRecentSyncSummary(sync);
        // Fire-and-forget: push is an enhancement and must never block or
        // fail the load. Honours the preference captured at onboarding.
        registerForPush(userId, p?.notification_preference);
        if (hc) {
          maybeAutoSync(userId);
        }
      } catch (e) {
        // A locally cached session can outlive the account it belongs to
        // (deleted from another device, say). There the JWT still looks valid
        // client-side but every fetch fails, and signing out is the only way
        // to escape a permanent spinner.
        //
        // Everything else — most importantly a dropped connection — must NOT
        // sign her out. That used to happen on any failure, so opening the app
        // with no signal ejected her from her account.
        if (isAuthFailure(e)) {
          console.error('Session is no longer valid, signing out:', e);
          try {
            await signOut();
          } catch (signOutError) {
            console.error('Sign-out during recovery also failed:', signOutError);
          }
        } else {
          if (isClockSkewError(e)) {
            // Survived the refresh-and-retry in withClockSkewRetry and
            // failed again — logged distinctly so a persistent (rather
            // than one-off) skew is easy to spot instead of reading as an
            // ordinary connectivity error.
            console.error(
              'PGRST303 (JWT issued at future) persisted through refresh + retry — treating as transient, not signing out:',
              e
            );
          } else {
            console.error('Could not load user data (keeping session):', e);
          }
          setLoadError(
            "I couldn't reach your data just now. Check your connection and try again."
          );
        }
      } finally {
        setDataLoading(false);
      }
    },
    [maybeAutoSync]
  );

  useEffect(() => {
    if (session?.user?.id) {
      loadUserData(session.user.id);
    } else {
      setProfile(null);
      setUnderstandings([]);
      setRelationships([]);
      setUnderstandingHistory([]);
      setDiscoveries([]);
      setActiveCuriosity(null);
      setHealthSourceConnected(false);
      setRecentSyncSummary(null);
    }
  }, [session?.user?.id, loadUserData]);

  // Covers "opens the app" beyond just a cold start — coming back to the
  // foreground from the background counts as opening it too.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const cameToForeground =
        /inactive|background/.test(appStateRef.current) && nextState === 'active';
      appStateRef.current = nextState;
      if (cameToForeground && session?.user?.id && healthSourceConnected) {
        maybeAutoSync(session.user.id);
      }
    });
    return () => sub.remove();
  }, [session?.user?.id, healthSourceConnected, maybeAutoSync]);

  async function handleOnboardingComplete(draft: OnboardingDraft) {
    if (!session?.user?.id) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const name = draft.name.trim() || null;
      const updated = await updateProfile(session.user.id, {
        name,
        preferred_name: name,
        dob: parseDob(draft.dob),
        life_stage: draft.lifeStage,
        goals: draft.story ? [draft.story] : [],
        notification_preference: draft.notifPref,
        shared_health_rows: draft.sharedHealthRows,
        height_cm: parseHeightToCm(draft.height),
        weight_kg: parseWeightToKg(draft.weight),
        onboarded_at: new Date().toISOString(),
      });
      setProfile(updated);
    } catch (e) {
      setCompleteError(
        e instanceof Error ? e.message : 'Something went wrong saving your profile.'
      );
    } finally {
      setCompleting(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (e) {
      // Rare (e.g. offline) and low-stakes — the user just stays signed
      // in and can tap again. Logged rather than left as an unhandled
      // rejection with no trace.
      console.error('Sign out failed:', e);
    }
  }

  async function handleAnswerCuriosity(answer: string) {
    if (!session?.user?.id || !activeCuriosity) return;
    await answerCuriosity(session.user.id, activeCuriosity, answer);
    setActiveCuriosity(null);
  }

  async function handleNameDiscovery(name: string) {
    if (!session?.user?.id || !pendingDiscovery) return;
    await nameDiscovery(session.user.id, pendingDiscovery.id, name);
    setDiscoveries((rows) =>
      rows.map((d) =>
        d.id === pendingDiscovery.id ? { ...d, name, status: 'named' as const } : d
      )
    );
  }

  if (!fontsLoaded || !splashDone) {
    return (
      <SafeAreaProvider>
        <AnimatedSplash
          ready={fontsLoaded && session !== undefined}
          onFinish={() => setSplashDone(true)}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      </SafeAreaProvider>
    );
  }

  // A failed load no longer signs her out, so it needs somewhere to land
  // other than a spinner that never resolves.
  if (!dataLoading && !profile && loadError) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <Text style={styles.retryTitle}>I can't reach your data.</Text>
          <Text style={styles.retryBody}>{loadError}</Text>
          <View style={styles.retryButton}>
            <PrimaryButton
              label="Try again"
              onPress={() => {
                if (session?.user?.id) loadUserData(session.user.id);
              }}
            />
          </View>
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (dataLoading || !profile) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!profile.onboarded_at) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          startStep={2}
          userId={session?.user?.id}
        />
        {completeError ? (
          <View style={styles.completeErrorBanner}>
            <Text style={styles.completeErrorText}>{completeError}</Text>
          </View>
        ) : null}
      </SafeAreaProvider>
    );
  }

  const strengths = Object.fromEntries(
    understandings.map((u) => [u.domain, u.strength])
  ) as Partial<Record<Domain, Strength>>;
  const hasPendingDiscovery = pendingDiscovery !== null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.app}>
        <View style={{ flex: 1 }}>
          {tab === 'today' && (
            <TodayScreen
              onOpenDiscoveryNudge={() => setDiscoveryFlowVisible(true)}
              onOpenUnderstanding={(d) => setUnderstandingDomain(d)}
              onOpenInfo={() => setTodayInfoVisible(true)}
              activeCuriosity={activeCuriosity}
              onAnswerCuriosity={handleAnswerCuriosity}
              hasPendingDiscovery={hasPendingDiscovery}
              understandings={understandings}
              preferredName={profile.preferred_name || profile.name || ''}
              recentSyncSummary={recentSyncSummary}
            />
          )}
          {tab === 'core' && (
            <CoreScreen
              onOpenUnderstanding={(d) => setUnderstandingDomain(d)}
              onOpenDiscovery={(id) => setSelectedDiscoveryId(id)}
              strengths={strengths}
              discoveries={discoveries}
            />
          )}
          {tab === 'you' && (
            <YouScreen
              profile={profile}
              healthSourceConnected={healthSourceConnected}
              onOpenRow={(section, row) => {
                if (section === 'privacy' && row === 'export') {
                  setDataPrivacyVisible(true);
                } else if (section === 'connections' && row === 'health-source') {
                  setHealthSyncVisible(true);
                } else if (PROFILE_FIELDS[row]) {
                  setEditRowId(row);
                } else if (isHealthNoteRow(row)) {
                  setHealthNoteRowId(row);
                } else {
                  setRowSheet({ section, row });
                }
              }}
              onSignOut={handleSignOut}
            />
          )}
        </View>
        <BottomNav active={tab} onChange={setTab} />
      </View>

      <TodayInfoSheet
        visible={todayInfoVisible}
        understandings={understandings}
        onClose={() => setTodayInfoVisible(false)}
      />

      <UnderstandingSheet
        domain={understandingDomain}
        understandings={understandings}
        relationships={relationships}
        history={understandingHistory}
        crossDomainUnderstandings={crossDomainUnderstandings}
        providerFeedback={providerFeedback}
        userId={session?.user?.id ?? null}
        profileLocation={profile?.location ?? null}
        onClose={() => setUnderstandingDomain(null)}
        onHelpLearnMore={() => {
          setUnderstandingDomain(null);
          setCuriosityVisible(true);
        }}
        onProviderFeedbackSaved={() => {
          if (session?.user?.id) loadUserData(session.user.id);
        }}
      />

      <CuriosityOverlay
        visible={curiosityVisible}
        onClose={() => setCuriosityVisible(false)}
        userId={session?.user?.id ?? null}
        activeCuriosity={activeCuriosity}
        onAnswerCuriosity={handleAnswerCuriosity}
      />

      <DiscoveryFlow
        visible={discoveryFlowVisible}
        discovery={pendingDiscovery}
        onNameDiscovery={handleNameDiscovery}
        onDone={() => setDiscoveryFlowVisible(false)}
      />

      <DiscoveryDetailSheet
        discovery={selectedDiscovery}
        onClose={() => setSelectedDiscoveryId(null)}
      />

      <ProfileEditSheet
        rowId={editRowId}
        profile={profile}
        onClose={() => setEditRowId(null)}
        onSave={async (patch) => {
          if (!session?.user?.id) return;
          const updated = await updateProfile(session.user.id, patch as never);
          setProfile(updated);
        }}
      />

      <HealthNoteSheet
        rowId={healthNoteRowId}
        userId={session?.user?.id ?? null}
        onClose={() => setHealthNoteRowId(null)}
        onSaved={() => {
          if (session?.user?.id) loadUserData(session.user.id);
        }}
      />

      <HealthSyncSheet
        visible={healthSyncVisible}
        userId={session?.user?.id ?? null}
        connected={healthSourceConnected}
        onClose={() => setHealthSyncVisible(false)}
        onSynced={() => {
          setHealthSourceConnected(true);
          if (session?.user?.id) {
            fetchRecentSyncSummary(session.user.id).then(setRecentSyncSummary).catch(() => {});
          }
        }}
      />

      <DataPrivacySheet
        visible={dataPrivacyVisible}
        userId={session?.user?.id ?? null}
        onClose={() => setDataPrivacyVisible(false)}
      />

      <BottomSheet visible={!!rowSheet} onClose={() => setRowSheet(null)}>
        {rowSheet ? (
          <View>
            <Text style={styles.rowSheetTitle}>
              {rowSheet.row.replace(/-/g, ' ')}
            </Text>
            <Text style={styles.rowSheetBody}>
              This is where I'll help you review and update this. For now,
              I'm still learning what matters most to show here.
            </Text>
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  retryTitle: {
    fontFamily: fontTokens.serif,
    fontSize: 26,
    color: colors.ink,
    textAlign: 'center',
  },
  retryBody: {
    fontFamily: fontTokens.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 10,
  },
  retryButton: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  app: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  rowSheetTitle: {
    fontFamily: fontTokens.serif,
    fontSize: 24,
    color: colors.ink,
    textTransform: 'capitalize',
  },
  rowSheetBody: {
    fontFamily: fontTokens.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 12,
  },
  completeErrorBanner: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  completeErrorText: {
    fontFamily: fontTokens.sans,
    fontSize: 13,
    color: colors.ink,
  },
});
