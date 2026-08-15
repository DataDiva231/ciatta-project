import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
import { fetchProfile, updateProfile } from './src/lib/profile';
import {
  fetchDiscoveries,
  fetchRelationships,
  fetchUnderstandingHistory,
  fetchUnderstandings,
  hasHealthSourceObservations,
  nameDiscovery,
  type DiscoveryRow,
  type RelationshipRow,
  type UnderstandingHistoryRow,
  type UnderstandingRow,
} from './src/lib/queries';
import { answerCuriosity, fetchActiveCuriosity, type ActiveCuriosity } from './src/lib/curiosity';
import type { Domain, Profile, Strength } from './src/lib/types';

import OnboardingFlow, {
  type OnboardingDraft,
} from './src/screens/onboarding/OnboardingFlow';
import TodayScreen from './src/screens/TodayScreen';
import CoreScreen from './src/screens/CoreScreen';
import YouScreen from './src/screens/YouScreen';
import BottomNav, { MainTab } from './src/components/BottomNav';

import UnderstandingSheet from './src/overlays/UnderstandingSheet';
import CuriosityOverlay from './src/overlays/CuriosityOverlay';
import DiscoveryFlow from './src/overlays/DiscoveryFlow';
import DiscoveryDetailSheet from './src/overlays/DiscoveryDetailSheet';
import DataPrivacySheet from './src/overlays/DataPrivacySheet';
import HealthSyncSheet from './src/overlays/HealthSyncSheet';
import BottomSheet from './src/components/BottomSheet';
import AnimatedSplash from './src/components/AnimatedSplash';

SplashScreen.preventAutoHideAsync().catch(() => {});

function parseDob(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
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
  const [discoveries, setDiscoveries] = useState<DiscoveryRow[]>([]);
  const [activeCuriosity, setActiveCuriosity] = useState<ActiveCuriosity | null>(null);
  const [healthSourceConnected, setHealthSourceConnected] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const [tab, setTab] = useState<MainTab>('today');
  const [understandingDomain, setUnderstandingDomain] = useState<Domain | null>(null);
  const [curiosityVisible, setCuriosityVisible] = useState(false);
  const [discoveryFlowVisible, setDiscoveryFlowVisible] = useState(false);
  const [selectedDiscoveryId, setSelectedDiscoveryId] = useState<string | null>(null);
  const [dataPrivacyVisible, setDataPrivacyVisible] = useState(false);
  const [healthSyncVisible, setHealthSyncVisible] = useState(false);
  const [rowSheet, setRowSheet] = useState<{ section: string; row: string } | null>(
    null
  );

  const pendingDiscovery = discoveries.find((d) => d.status === 'pending') ?? null;
  const selectedDiscovery = discoveries.find((d) => d.id === selectedDiscoveryId) ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    setDataLoading(true);
    try {
      const [p, u, r, h, d, c, hc] = await Promise.all([
        fetchProfile(userId),
        fetchUnderstandings(userId),
        fetchRelationships(userId),
        fetchUnderstandingHistory(userId),
        fetchDiscoveries(userId),
        fetchActiveCuriosity(userId),
        hasHealthSourceObservations(userId),
      ]);
      setProfile(p);
      setUnderstandings(u);
      setRelationships(r);
      setUnderstandingHistory(h);
      setDiscoveries(d);
      setActiveCuriosity(c);
      setHealthSourceConnected(hc);
    } catch (e) {
      // A locally cached session can outlive the account it belongs to
      // (e.g. deleted from another device, or deleted then the app
      // resumed from background without ever re-checking auth state).
      // The JWT still looks valid client-side, but every fetch here fails
      // because the underlying rows are gone. Without this, profile stays
      // null forever and the app is stuck on the loading spinner below —
      // signing out clears the stale session and returns to onboarding.
      console.error('Failed to load user data, signing out:', e);
      try {
        await signOut();
      } catch (signOutError) {
        // Nothing more we can do locally — surfacing this would just be a
        // second stuck state. Logged so it's not silently invisible.
        console.error('Sign-out during recovery also failed:', signOutError);
      }
    } finally {
      setDataLoading(false);
    }
  }, []);

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
    }
  }, [session?.user?.id, loadUserData]);

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
        <StatusBar style="light" />
        <OnboardingFlow onComplete={handleOnboardingComplete} />
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
        <StatusBar style="light" />
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          startStep={4}
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
              activeCuriosity={activeCuriosity}
              onAnswerCuriosity={handleAnswerCuriosity}
              hasPendingDiscovery={hasPendingDiscovery}
              understandings={understandings}
              preferredName={profile.preferred_name || profile.name || ''}
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

      <UnderstandingSheet
        domain={understandingDomain}
        understandings={understandings}
        relationships={relationships}
        history={understandingHistory}
        onClose={() => setUnderstandingDomain(null)}
        onHelpLearnMore={() => {
          setUnderstandingDomain(null);
          setCuriosityVisible(true);
        }}
      />

      <CuriosityOverlay
        visible={curiosityVisible}
        onClose={() => setCuriosityVisible(false)}
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

      <HealthSyncSheet
        visible={healthSyncVisible}
        userId={session?.user?.id ?? null}
        connected={healthSourceConnected}
        onClose={() => setHealthSyncVisible(false)}
        onSynced={() => setHealthSourceConnected(true)}
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
    backgroundColor: colors.dark,
    borderRadius: 12,
    padding: 16,
  },
  completeErrorText: {
    fontFamily: fontTokens.sans,
    fontSize: 13,
    color: colors.white,
  },
});
