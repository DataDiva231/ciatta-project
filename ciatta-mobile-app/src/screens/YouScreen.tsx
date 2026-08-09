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
          label="Life stage"
          value={profile.life_stage || 'Not set'}
          onPress={() => onOpenRow('who-you-are', 'life-stage')}
        />
        <DisclosureRow
          label="Goals & focus"
          value={
            profile.goals.length > 0 ? `${profile.goals.length} priorities` : 'Not set'
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
        {healthItems.map((item, i) => (
          <DisclosureRow
            key={item.id}
            label={item.label}
            value={item.value}
            last={i === healthItems.length - 1}
            onPress={() => onOpenRow('your-health', item.id)}
          />
        ))}
      </Card>

      <Text style={styles.section}>YOUR CONNECTIONS</Text>
      <Text style={styles.sectionHint}>Connected data makes understanding stronger.</Text>
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
