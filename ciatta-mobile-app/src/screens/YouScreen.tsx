import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from '../theme/tokens';
import { connections, healthItems } from '../lib/mockData';
import type { Profile } from '../lib/types';
import ScreenContainer from '../components/ScreenContainer';
import Avatar from '../components/Avatar';
import DisclosureRow from '../components/DisclosureRow';
import { CARE_YOU_ROWS } from '../lib/careConnection';
import { displayCopy } from '../lib/displayCopy';
import { ChevronIcon } from '../components/icons';

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

function formatDob(dob: string | null): string {
  if (!dob) return 'Not set';
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return displayCopy(dob);
  return displayCopy(
    parsed.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  );
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = Date.now() - parsed.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function SettingsGroup({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <View style={styles.groupWrap}>
      <View style={styles.group}>{children}</View>
      {footer ? <Text style={styles.groupFooter}>{footer}</Text> : null}
    </View>
  );
}

export default function YouScreen({
  profile,
  healthSourceConnected,
  onOpenRow,
  onSignOut,
  hasEligibleCareConnection = false,
  sharedSummaryCount = 0,
}: {
  profile: Profile;
  healthSourceConnected: boolean;
  onOpenRow: (section: string, row: string) => void;
  onSignOut: () => void;
  hasEligibleCareConnection?: boolean;
  sharedSummaryCount?: number;
}) {
  const displayName = displayCopy(profile.preferred_name || profile.name || 'You');
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

  return (
    <ScreenContainer>
      <Text style={styles.screenTitle}>You</Text>

      <SettingsGroup>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={displayName}
          onPress={() => onOpenRow('who-you-are', 'identity')}
          style={({ pressed }) => [styles.profileRow, pressed && { opacity: 0.6 }]}
        >
          <Avatar tone="ink" initial={displayName[0]?.toUpperCase() ?? 'Y'} size={60} />
          <View style={styles.profileText}>
            <Text style={styles.profileName}>
              {displayName}
              {age ? `, ${age}` : ''}
            </Text>
            <Text style={styles.profileSub}>
              {profile.life_stage ? displayCopy(profile.life_stage) : 'Life stage not set'}
            </Text>
          </View>
          <ChevronIcon />
        </Pressable>
      </SettingsGroup>

      <SettingsGroup>
        <DisclosureRow
          label="Date of birth"
          value={formatDob(profile.dob)}
          onPress={() => onOpenRow('who-you-are', 'dob')}
        />
        <DisclosureRow
          label="Life stage"
          value={profile.life_stage ? displayCopy(profile.life_stage) : 'Not set'}
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
          value={profile.about ? displayCopy(profile.about) : 'A few words about you'}
          last
          onPress={() => onOpenRow('who-you-are', 'about')}
        />
      </SettingsGroup>

      <SettingsGroup footer="This helps your picture stay accurate.">
        {healthItemsWithRealStatus.map((item, i) => (
          <DisclosureRow
            key={item.id}
            label={item.label}
            value={item.value}
            last={i === healthItemsWithRealStatus.length - 1}
            onPress={() => onOpenRow('your-health', item.id)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup footer="A place to prepare for a provider conversation. This does not diagnose or decide treatment.">
        {CARE_YOU_ROWS.map((item, i) => (
          <DisclosureRow
            key={item.id}
            label={item.label}
            value={
              item.id === 'shared'
                ? sharedSummaryCount > 0
                  ? `${sharedSummaryCount} ${sharedSummaryCount === 1 ? 'summary' : 'summaries'}`
                  : 'None yet'
                : item.id === 'visit-prep' || item.id === 'provider'
                ? hasEligibleCareConnection
                  ? 'Ready to prepare'
                  : 'Nothing to discuss yet'
                : undefined
            }
            last={i === CARE_YOU_ROWS.length - 1}
            onPress={() => onOpenRow('care', item.id)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup footer="The more you connect, including your provider, the more complete your picture becomes.">
        {connectionsWithRealStatus.map((c, i) => (
          <DisclosureRow
            key={c.id}
            label={c.label}
            value={connectionStatusLabel[c.status]}
            last={i === connectionsWithRealStatus.length - 1}
            onPress={() => onOpenRow('connections', c.id)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup footer="You're in control of your data.">
        <DisclosureRow
          label="Data & permissions"
          onPress={() => onOpenRow('privacy', 'permissions')}
        />
        <DisclosureRow
          label="How we reach you"
          onPress={() => onOpenRow('privacy', 'reach-me')}
        />
        <DisclosureRow
          label="Export or delete data"
          last
          onPress={() => onOpenRow('privacy', 'export')}
        />
      </SettingsGroup>

      <SettingsGroup>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={onSignOut}
          style={({ pressed }) => [styles.signOutRow, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </SettingsGroup>

      <Text style={styles.legal}>Ciatta · Privacy Policy · Terms of Service</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    ...type.title2,
    color: colors.ink,
    marginBottom: 20,
  },
  groupWrap: {
    marginBottom: 35,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 40,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  groupFooter: {
    ...fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink3,
    marginTop: 8,
    marginHorizontal: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 76,
  },
  profileText: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  profileName: {
    ...type.headline,
    color: colors.ink,
  },
  profileSub: {
    ...type.subheadline,
    color: colors.ink2,
    marginTop: 2,
  },
  signOutRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    minHeight: 44,
  },
  signOutText: {
    ...type.body,
    color: colors.accent,
  },
  legal: {
    ...fonts.sans,
    fontSize: 12,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: -8,
  },
});
