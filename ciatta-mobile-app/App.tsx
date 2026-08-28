import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';

import { colors, fonts as fontTokens, type } from './src/theme/tokens';
import GlassSurface from './src/components/GlassSurface';
import { supabase } from './src/lib/supabase';
import { signOut, getSession } from './src/lib/auth';
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
import { answerCuriosity, fetchActiveCuriosity, fetchNextOnboardingQuestion, type ActiveCuriosity } from './src/lib/curiosity';
import { fetchLastHealthSyncAt, fetchProviderFeedback, fetchRecentSyncSummary, fetchVisitPrepShared, type ProviderFeedbackRow, type RecentSyncSummary } from './src/lib/observations';
import { registerForPush } from './src/lib/notifications';
import { connectHealthConnect } from './src/lib/healthConnect';
import { connectHealthKit } from './src/lib/healthKit';
import { syncCalendarContext } from './src/lib/calendarContext';
import { saveHealthNote } from './src/lib/healthNotes';
import { domainLabel } from './src/lib/mockData';
import { displayCopy } from './src/lib/displayCopy';
import type { Domain, Profile, Strength } from './src/lib/types';

import OnboardingFlow, {
  type OnboardingDraft,
} from './src/screens/onboarding/OnboardingFlow';
import { ONBOARDING_CONVERSATION_STEP } from './src/lib/onboardingConversation';
import { isEligibleCareConnection, selectCareNotice, CARE_YOU_ROWS } from './src/lib/careConnection';
import { completeOnboardingAfterAuth } from './src/lib/onboardingComplete';
import { clearGuestOnboardingDraft } from './src/lib/onboardingDraft';
import TodayScreen from './src/screens/TodayScreen';
import CoreScreen from './src/screens/CoreScreen';
import YouScreen from './src/screens/YouScreen';
import BottomNav, { MainTab } from './src/components/BottomNav';
import { NavAdaptivityProvider } from './src/lib/navAdaptivityContext';

import UnderstandingSheet from './src/overlays/UnderstandingSheet';
import ProviderSearchSheet from './src/overlays/ProviderSearchSheet';
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

function careYouLabel(rowId: string): string {
  return CARE_YOU_ROWS.find((r) => r.id === rowId)?.label ?? rowId.replace(/-/g, ' ');
}

function sharedSummaryLine(row: ProviderFeedbackRow): string {
  const domain = typeof row.value?.domain === 'string' ? row.value.domain : null;
  const domainText =
    domain && domain in domainLabel ? domainLabel[domain as Domain] : 'Visit summary';
  const when = displayCopy(
    new Date(row.recorded_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  );
  return `${domainText} · ${when}`;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [understandings, setUnderstandings] = useState<UnderstandingRow[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [understandingHistory, setUnderstandingHistory] = useState<UnderstandingHistoryRow[]>([]);
  const [crossDomainUnderstandings, setCrossDomainUnderstandings] = useState<
    CrossDomainUnderstandingRow[]
  >([]);
  const [providerFeedback, setProviderFeedback] = useState<ProviderFeedbackRow[]>([]);
  const [visitPrepShared, setVisitPrepShared] = useState<ProviderFeedbackRow[]>([]);
  const [discoveries, setDiscoveries] = useState<DiscoveryRow[]>([]);
  const [activeCuriosity, setActiveCuriosity] = useState<ActiveCuriosity | null>(null);
  const [healthSourceConnected, setHealthSourceConnected] = useState(false);
  const [recentSyncSummary, setRecentSyncSummary] = useState<RecentSyncSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const holdingOnboardingRef = useRef(false);

  const [tab, setTab] = useState<MainTab>('today');
  const [understandingDomain, setUnderstandingDomain] = useState<Domain | null>(null);
  const [startUnderstandingWithProviderSearch, setStartUnderstandingWithProviderSearch] =
    useState(false);
  const [youProviderSearchVisible, setYouProviderSearchVisible] = useState(false);
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
        const [p, u, r, h, cd, pf, d, c, hc, sync, briefs] = await withClockSkewRetry(
          () =>
            Promise.all([
              fetchProfile(userId).catch((err) => {
                console.error('[data] profile failed', err);
                throw err;
              }),
              fetchUnderstandings(userId).catch((err) => {
                console.error('[data] understandings failed', err);
                throw err;
              }),
              fetchRelationships(userId).catch((err) => {
                console.error('[data] relationships failed', err);
                throw err;
              }),
              fetchUnderstandingHistory(userId).catch((err) => {
                console.error('[data] history failed', err);
                throw err;
              }),
              fetchCrossDomainUnderstandings(userId).catch((err) => {
                console.error('[data] crossDomain failed', err);
                throw err;
              }),
              fetchProviderFeedback(userId).catch((err) => {
                console.error('[data] providerFeedback failed', err);
                throw err;
              }),
              fetchDiscoveries(userId).catch((err) => {
                console.error('[data] discoveries failed', err);
                throw err;
              }),
              fetchActiveCuriosity(userId).catch((err) => {
                console.error('[data] curiosity failed', err);
                throw err;
              }),
              hasHealthSourceObservations(userId).catch((err) => {
                console.error('[data] healthSource failed', err);
                throw err;
              }),
              fetchRecentSyncSummary(userId).catch((err) => {
                console.error('[data] syncSummary failed', err);
                throw err;
              }),
              fetchVisitPrepShared(userId).catch((err) => {
                console.error('[data] visitPrep failed', err);
                throw err;
              }),
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
        setVisitPrepShared(briefs);
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
            console.error('Sign out during recovery also failed:', signOutError);
          }
        } else {
          if (isClockSkewError(e)) {
            // Survived the refresh-and-retry in withClockSkewRetry and
            // failed again — logged distinctly so a persistent (rather
            // than one-off) skew is easy to spot instead of reading as an
            // ordinary connectivity error.
            console.error(
              'PGRST303 (JWT issued at future) persisted through refresh + retry, treating as transient, not signing out:',
              e
            );
          } else {
            console.error('Could not load user data (keeping session):', e);
          }
          const detail = e instanceof Error ? e.message : '';
          setLoadError(
            __DEV__ && detail
              ? detail
              : "Your data couldn't be reached just now. Check your connection and try again."
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
    const sessionNow = (await getSession()) ?? session;
    const userId = sessionNow?.user?.id;
    if (!userId) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await completeOnboardingAfterAuth(userId, draft, {
        fetchProfile,
        updateProfile,
        fetchNext: fetchNextOnboardingQuestion,
        answer: answerCuriosity,
        syncHealth: async (id) => {
          try {
            if (Platform.OS === 'android') await connectHealthConnect(id);
            else if (Platform.OS === 'ios') await connectHealthKit(id);
          } catch (healthError) {
            console.error('Health source sync after onboarding failed:', healthError);
          }
        },
        syncCalendar: async (id) => {
          try {
            await syncCalendarContext(id);
          } catch (calendarError) {
            console.error('Calendar context after onboarding failed:', calendarError);
          }
        },
        saveHealthNotes: async (id, notes) => {
          for (const [category, text] of Object.entries(notes)) {
            if (text.trim()) await saveHealthNote(id, category, text);
          }
        },
        clearGuestDraft: clearGuestOnboardingDraft,
        loadUserData,
      });
      if (result.status === 'entered-existing-account' || result.status === 'onboarded') {
        setProfile(result.profile as Profile);
      }
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

  if (!splashDone) {
    return (
      <SafeAreaProvider>
        <AnimatedSplash
          ready={session !== undefined}
          onFinish={() => setSplashDone(true)}
        />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  if (session && profile && profile.onboarded_at) {
    holdingOnboardingRef.current = false;
  } else {
    if (!session) {
      holdingOnboardingRef.current = true;
    }

    if (session && !holdingOnboardingRef.current) {
      if (!dataLoading && !profile && loadError) {
        return (
          <SafeAreaProvider>
            <View style={styles.loading}>
              <Text style={styles.retryTitle}>Your data couldn't be reached just now.</Text>
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
    }

    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          startStep={session && !holdingOnboardingRef.current ? ONBOARDING_CONVERSATION_STEP : 0}
          userId={session?.user?.id}
        />
        {completeError ? (
          <GlassSurface
            kind="regular"
            tintColor={colors.white}
            style={styles.completeErrorBanner}
            fallbackStyle={styles.completeErrorFallback}
          >
            <Text style={styles.completeErrorText}>{completeError}</Text>
          </GlassSurface>
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
      <NavAdaptivityProvider>
      <View style={styles.app}>
        <View style={{ flex: 1 }}>
          {tab === 'today' && (
            <TodayScreen
              userId={session?.user?.id}
              onOpenDiscoveryNudge={() => setDiscoveryFlowVisible(true)}
              onOpenUnderstanding={(d) => setUnderstandingDomain(d)}
              onOpenInfo={() => setTodayInfoVisible(true)}
              activeCuriosity={activeCuriosity}
              onAnswerCuriosity={handleAnswerCuriosity}
              hasPendingDiscovery={hasPendingDiscovery}
              understandings={understandings}
              preferredName={profile.preferred_name || profile.name || ''}
              recentSyncSummary={recentSyncSummary}
              relationships={relationships}
              goals={profile?.goals ?? []}
              history={understandingHistory}
              crossDomain={crossDomainUnderstandings}
            />
          )}
          {tab === 'core' && (
            <CoreScreen
              onOpenUnderstanding={(d) => setUnderstandingDomain(d)}
              onOpenDiscovery={(id) => setSelectedDiscoveryId(id)}
              strengths={strengths}
              discoveries={discoveries}
              understandings={understandings}
              relationships={relationships}
            />
          )}
          {tab === 'you' && (
            <YouScreen
              profile={profile}
              healthSourceConnected={healthSourceConnected}
              hasEligibleCareConnection={understandings.some(isEligibleCareConnection)}
              sharedSummaryCount={visitPrepShared.length}
              onOpenRow={(section, row) => {
                if (section === 'privacy' && row === 'export') {
                  setDataPrivacyVisible(true);
                } else if (section === 'connections' && row === 'health-source') {
                  setHealthSyncVisible(true);
                } else if (section === 'care' && row === 'provider') {
                  const notice = selectCareNotice(understandings);
                  if (notice) {
                    setStartUnderstandingWithProviderSearch(true);
                    setUnderstandingDomain(notice.domain);
                  } else {
                    setYouProviderSearchVisible(true);
                  }
                } else if (section === 'care' && row === 'visit-prep') {
                  const notice = selectCareNotice(understandings);
                  if (notice) setUnderstandingDomain(notice.domain);
                  else setRowSheet({ section, row });
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
      </NavAdaptivityProvider>

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
        goals={profile?.goals ?? []}
        startWithProviderSearch={startUnderstandingWithProviderSearch}
        onClose={() => {
          setUnderstandingDomain(null);
          setStartUnderstandingWithProviderSearch(false);
        }}
        onHelpLearnMore={() => {
          setUnderstandingDomain(null);
          setStartUnderstandingWithProviderSearch(false);
          setCuriosityVisible(true);
        }}
        onProviderFeedbackSaved={() => {
          if (session?.user?.id) loadUserData(session.user.id);
        }}
      />

      <ProviderSearchSheet
        visible={youProviderSearchVisible}
        understandingId={null}
        careRecommendationType={null}
        profileLocation={profile?.location ?? null}
        onClose={() => setYouProviderSearchVisible(false)}
        onSelectProvider={() => setYouProviderSearchVisible(false)}
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
              {displayCopy(careYouLabel(rowSheet.row))}
            </Text>
            {rowSheet.section === 'care' && rowSheet.row === 'shared' && visitPrepShared.length > 0 ? (
              <View style={styles.sharedList}>
                {visitPrepShared.map((row) => (
                  <Text key={row.id} style={styles.rowSheetItem}>
                    {sharedSummaryLine(row)}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.rowSheetBody}>
                {rowSheet.section === 'care' && rowSheet.row === 'shared'
                  ? 'Summaries you prepare for a visit are assembled from what you have already learned. They are not stored as a diagnosis. After you share one from an Understanding, you can come back here to see it listed.'
                  : rowSheet.section === 'care'
                    ? 'When something is worth discussing with a provider, you can prepare a summary from Today, Core, or an Understanding. This does not diagnose or decide treatment.'
                    : 'This is where you can review and update this. For now, there isn\'t more to show here.'}
              </Text>
            )}
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
    ...type.title2,
    color: colors.ink,
    textAlign: 'center',
  },
  retryBody: {
    ...fontTokens.sans,
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
    ...type.title2,
    color: colors.ink,
    textTransform: 'capitalize',
  },
  rowSheetBody: {
    ...fontTokens.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 12,
  },
  sharedList: {
    marginTop: 12,
    gap: 10,
  },
  rowSheetItem: {
    ...fontTokens.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
  },
  completeErrorBanner: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
  },
  completeErrorFallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  completeErrorText: {
    ...fontTokens.sans,
    fontSize: 13,
    color: colors.ink,
  },
});
