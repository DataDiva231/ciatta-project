import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { connections, healthItems } from '../lib/mockData';
import type { Profile } from '../lib/types';
import ScreenContainer from '../components/ScreenContainer';
import EditorialHeader from '../components/EditorialHeader';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import DisclosureRow from '../components/DisclosureRow';

const connectionStatusLabel: Record<string, string> = {
  connected: 'Connected',
  'coming-soon': 'Coming soon',
  'not-connected': 'Not connected',
};

// Onboarding's sharing checkboxes use their own short ids; only these three
// health categories are actually asked about there today, so only these
// three can ever honestly say "Shared" — the rest stay "Not shared yet"
// until something collects them.
const ONBOARDING_ROW_TO_HEALTH_ITEM: Record<string, string> = {
  cycle: 'cycle',
  medical: 'medical-history',
  meds: 'medications',
};

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = Date.now() - parsed.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export default function YouScreen({
  profile,
  healthSourceConnected,
  onOpenRow,
  onSignOut,
}: {
  profile: Profile;
  healthSourceConnected: boolean;
  onOpenRow: (section: string, row: string) => void;
  onSignOut: () => void;
}) {
  const displayName = profile.preferred_name || profile.name || 'You';
  const connectionsWithRealStatus = connections.map((c) =>
    c.id === 'health-source'
      ? { ...c, status: healthSourceConnected ? ('connected' as const) : c.status }
      : c
  );
  const sharedHealthItemIds = new Set(
    // Onboarding writes its own short ids ('medical', 'meds'); the health
    // rows write their own ('medical-history', 'medications'). Accept both,
    // otherwise a note saved from this screen never shows as shared.
    profile.shared_health_rows.map((id) => ONBOARDING_ROW_TO_HEALTH_ITEM[id] ?? id).filter(Boolean)
  );
  const healthItemsWithRealStatus = healthItems.map((item) =>
    sharedHealthItemIds.has(item.id) ? { ...item, value: 'Shared' } : item
  );
  const age = ageFromDob(profile.dob);
  const identityLine = profile.name
    ? age
      ? `${profile.name}, ${age}`
      : profile.name
    : 'Not set';

  return (
    <ScreenContainer>
      <EditorialHeader title="You" subtitle="Everything that helps me understand you better." />

      <Card style={styles.profileCard}>
        <Avatar initial={displayName[0]?.toUpperCase() ?? 'Y'} size={52} />
        <View style={{ marginLeft: 14 }}>
          <Text style={styles.profileName}>
            {displayName}
            {age ? `, ${age}` : ''}
          </Text>
          <Text style={styles.profileSub}>{profile.life_stage || 'Life stage not set'}</Text>
        </View>
      </Card>

      <Text style={styles.section}>WHO YOU ARE</Text>
      <Card style={styles.groupCard}>
        <DisclosureRow
          label="Identity"
          value={identityLine}
          onPress={() => onOpenRow('who-you-are', 'identity')}
        />
        <DisclosureRow
          label="Date of birth"
          value={profile.dob || 'Not set'}
          onPress={() => onOpenRow('who-you-are', 'dob')}
        />
        <DisclosureRow
          label="Pronouns"
          value={profile.pronouns || 'Not set'}
          onPress={() => onOpenRow('who-you-are', 'pronouns')}
        />
        <DisclosureRow
          label="Life stage"
          value={profile.life_stage || 'Not set'}
          onPress={() => onOpenRow('who-you-are', 'life-stage')}
        />
        <DisclosureRow
          label="Goals & focus"
          value={
            profile.goals.length > 0
              ? `${profile.goals.length} ${profile.goals.length === 1 ? 'priority' : 'priorities'}`
              : 'Not set'
          }
          onPress={() => onOpenRow('who-you-are', 'goals')}
        />
        <DisclosureRow
          label="About you"
          value={profile.about || 'A few words about you'}
          last
          onPress={() => onOpenRow('who-you-are', 'about')}
        />
      </Card>

      <Text style={styles.section}>YOUR HEALTH</Text>
      <Text style={styles.sectionHint}>
        This helps me understand you more accurately.
      </Text>
      <Card style={styles.groupCard}>
        {healthItemsWithRealStatus.map((item, i) => (
          <DisclosureRow
            key={item.id}
            label={item.label}
            value={item.value}
            last={i === healthItemsWithRealStatus.length - 1}
            onPress={() => onOpenRow('your-health', item.id)}
          />
        ))}
      </Card>

      <Text style={styles.section}>YOUR CONNECTIONS</Text>
      <Text style={styles.sectionHint}>
        The more you connect — including your provider — the more context Ciatta has to work with.
      </Text>
      <Card style={styles.groupCard}>
        {connectionsWithRealStatus.map((c, i) => (
          <DisclosureRow
            key={c.id}
            label={c.label}
            value={connectionStatusLabel[c.status]}
            last={i === connectionsWithRealStatus.length - 1}
            onPress={() => onOpenRow('connections', c.id)}
          />
        ))}
      </Card>

      <Text style={styles.section}>PRIVACY & CONTROL</Text>
      <Text style={styles.sectionHint}>You're in control of your data.</Text>
      <Card style={styles.groupCard}>
        <DisclosureRow
          label="Data & permissions"
          onPress={() => onOpenRow('privacy', 'permissions')}
        />
        <DisclosureRow
          label="How Ciatta reaches me"
          onPress={() => onOpenRow('privacy', 'reach-me')}
        />
        <DisclosureRow
          label="Export or delete data"
          last
          onPress={() => onOpenRow('privacy', 'export')}
        />
      </Card>

      <Card onPress={onSignOut} style={styles.signOutCard}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Ciatta · Privacy Policy · Terms of Service</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  profileName: {
    fontFamily: fonts.serif,
    fontSize: 20,
    color: colors.ink,
  },
  profileSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink2,
    marginTop: 2,
  },
  section: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginTop: 26,
  },
  sectionHint: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink3,
    marginTop: 4,
    marginBottom: 12,
  },
  groupCard: {
    padding: 4,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  signOutCard: {
    marginTop: 26,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14.5,
    color: colors.accent,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.ink3,
  },
});
