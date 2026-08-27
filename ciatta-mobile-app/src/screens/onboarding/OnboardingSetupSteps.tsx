import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { colors, fonts, type } from '../../theme/tokens';
import PrimaryButton from '../../components/PrimaryButton';
import GhostButton from '../../components/GhostButton';
import DisclosureRow from '../../components/DisclosureRow';
import { connections, healthItems } from '../../lib/mockData';
import { displayCopy } from '../../lib/displayCopy';
import {
  HEALTH_SOURCE_DATA_POINTS,
  MEDICAL_IMPORT_POINTS,
  SUGGESTED_HEALTH_TESTS,
  WEARABLE_SOURCES,
  type PendingHealthDocument,
} from '../../lib/onboardingSetup';
import { requestCalendarPermission } from '../../lib/calendarContext';
import HealthNoteSheet from '../../overlays/HealthNoteSheet';
import ProviderSearchSheet from '../../overlays/ProviderSearchSheet';
import HealthSyncSheet from '../../overlays/HealthSyncSheet';
import BottomSheet from '../../components/BottomSheet';

const SKIP_LABEL = "I'll do this later";

function StepFrame({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function MentalHealthStep({ onContinue }: { onContinue: () => void }) {
  return (
    <StepFrame>
      <Text style={styles.title}>How you feel belongs here too.</Text>
      <Text style={styles.subtitle}>
        Sleep, energy, and cycle are only part of the picture. Mental and emotional health sits
        alongside them, so understanding can take shape across the whole person, not as a separate
        clinical track.
      </Text>
      <View style={{ flex: 1 }} />
      <PrimaryButton label="Continue" onPress={onContinue} />
    </StepFrame>
  );
}

export function HealthDocumentsStep({
  userId,
  sharedIds,
  documents,
  suggestedTests,
  onDocumentsChange,
  onSuggestedTestsChange,
  onGuestSave,
  onSaved,
  onContinue,
  onSkip,
}: {
  userId: string | null;
  sharedIds: string[];
  documents: PendingHealthDocument[];
  suggestedTests: string[];
  onDocumentsChange: (next: PendingHealthDocument[]) => void;
  onSuggestedTestsChange: (next: string[]) => void;
  onGuestSave: (rowId: string, text: string) => void;
  onSaved: (rowId: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [rowId, setRowId] = useState<string | null>(null);
  const [testsOpen, setTestsOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const shared = new Set(sharedIds);
  const selectedTests = new Set(suggestedTests);

  async function addFiles() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      const next = result.assets.map((asset) => ({
        id: `${asset.uri}-${asset.name}`,
        name: asset.name || 'Health document',
        kind: 'file' as const,
      }));
      onDocumentsChange([...documents, ...next]);
    } catch {
      /* Picker is optional. */
    } finally {
      setPicking(false);
    }
  }

  async function addPhotos() {
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.9,
      });
      if (result.canceled) return;
      const next = result.assets.map((asset, index) => ({
        id: asset.uri,
        name: asset.fileName || `Photo ${documents.length + index + 1}`,
        kind: 'photo' as const,
      }));
      onDocumentsChange([...documents, ...next]);
    } catch {
      /* Picker is optional. */
    } finally {
      setPicking(false);
    }
  }

  function toggleTest(id: string) {
    if (selectedTests.has(id)) {
      onSuggestedTestsChange(suggestedTests.filter((row) => row !== id));
    } else {
      onSuggestedTestsChange([...suggestedTests, id]);
    }
  }

  return (
    <StepFrame>
      <Text style={styles.title}>Health documents.</Text>
      <Text style={styles.subtitle}>
        Add lab results, wearable exports, photos, or notes you already have. Everything here is
        optional, and you can finish later in You.
      </Text>
      <Group>
        <DisclosureRow
          label="Upload a file"
          value={
            documents.some((d) => d.kind === 'file')
              ? `${documents.filter((d) => d.kind === 'file').length} added`
              : 'Lab results, exports, PDFs'
          }
          onPress={addFiles}
        />
        <DisclosureRow
          label="Add a photo"
          value={
            documents.some((d) => d.kind === 'photo')
              ? `${documents.filter((d) => d.kind === 'photo').length} added`
              : 'Pages, screenshots, scans'
          }
          onPress={addPhotos}
        />
        <DisclosureRow
          label="Suggested tests and scans"
          value={
            suggestedTests.length > 0 ? `${suggestedTests.length} selected` : 'Optional ideas'
          }
          last
          onPress={() => setTestsOpen(true)}
        />
      </Group>

      <Text style={styles.sectionLabel}>NOTES YOU CAN ADD</Text>
      <Group>
        {healthItems.map((item, i) => (
          <DisclosureRow
            key={item.id}
            label={item.label}
            value={shared.has(item.id) ? 'Shared' : 'Not shared yet'}
            last={i === healthItems.length - 1}
            onPress={() => setRowId(item.id)}
          />
        ))}
      </Group>

      {documents.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>ADDED</Text>
          <Group>
            {documents.map((doc, i) => (
              <DisclosureRow
                key={doc.id}
                label={displayCopy(doc.name)}
                value={doc.kind === 'photo' ? 'Photo' : 'File'}
                last={i === documents.length - 1}
                onPress={() => onDocumentsChange(documents.filter((row) => row.id !== doc.id))}
              />
            ))}
          </Group>
        </>
      ) : null}

      <View style={{ flex: 1 }} />
      <PrimaryButton label="Continue" onPress={onContinue} loading={picking} />
      <GhostButton label={SKIP_LABEL} onPress={onSkip} />
      <HealthNoteSheet
        rowId={rowId}
        userId={userId}
        onClose={() => setRowId(null)}
        onSaved={onSaved}
        onGuestSave={onGuestSave}
      />
      <BottomSheet visible={testsOpen} onClose={() => setTestsOpen(false)}>
        <Text style={styles.sheetTitle}>Suggested tests and scans</Text>
        <Text style={styles.sheetBody}>
          These are ideas that can round out the picture. Selecting one only marks it for you. It
          does not order a test or share anything with a clinic.
        </Text>
        <View style={{ marginTop: 16 }}>
          {SUGGESTED_HEALTH_TESTS.map((test, i) => (
            <DisclosureRow
              key={test.id}
              label={test.label}
              value={selectedTests.has(test.id) ? 'Selected' : 'Not selected'}
              last={i === SUGGESTED_HEALTH_TESTS.length - 1}
              onPress={() => toggleTest(test.id)}
            />
          ))}
        </View>
        <View style={{ marginTop: 20 }}>
          <PrimaryButton label="Done" onPress={() => setTestsOpen(false)} />
        </View>
      </BottomSheet>
    </StepFrame>
  );
}

export function MedicalRecordsStep({
  profileLocation,
  onContinue,
  onSkip,
}: {
  userId: string | null;
  profileLocation: string | null;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const medical = connections.find((c) => c.label === 'Medical records');

  return (
    <StepFrame>
      <Text style={styles.title}>Medical records.</Text>
      <Text style={styles.subtitle}>
        Connecting a provider can bring in visits, labs, and medications already on file. You choose
        what is imported. Nothing moves without your permission.
      </Text>
      <Group>
        {medical ? (
          <DisclosureRow
            label={medical.label}
            value="Not connected"
            onPress={() => setRecordsOpen(true)}
          />
        ) : null}
        <DisclosureRow
          label="Find a provider"
          value="Search"
          onPress={() => setSearchOpen(true)}
        />
        <DisclosureRow
          label="What can be imported"
          value="Visits, labs, medications"
          last
          onPress={() => setImportOpen(true)}
        />
      </Group>
      <Text style={styles.privacy}>
        Records stay yours. They are used to help you make sense of what changes. They are not sold.
      </Text>
      <View style={{ flex: 1 }} />
      <PrimaryButton label="Continue" onPress={onContinue} />
      <GhostButton label="Continue without connecting" onPress={onSkip} />
      <ProviderSearchSheet
        visible={searchOpen}
        understandingId={null}
        careRecommendationType={null}
        profileLocation={profileLocation}
        onClose={() => setSearchOpen(false)}
        onSelectProvider={() => setSearchOpen(false)}
      />
      <BottomSheet visible={recordsOpen} onClose={() => setRecordsOpen(false)}>
        <Text style={styles.sheetTitle}>{medical?.label ?? 'Medical records'}</Text>
        <Text style={styles.sheetBody}>
          Connecting records uses your permission at the provider. You can continue without this
          and come back later in You.
        </Text>
      </BottomSheet>
      <BottomSheet visible={importOpen} onClose={() => setImportOpen(false)}>
        <Text style={styles.sheetTitle}>What can be imported</Text>
        <Text style={styles.sheetBody}>
          When a connection is allowed, these are the kinds of information that can come in.
        </Text>
        {MEDICAL_IMPORT_POINTS.map((line) => (
          <Text key={line} style={styles.bullet}>
            {`• ${line}`}
          </Text>
        ))}
      </BottomSheet>
    </StepFrame>
  );
}

export function WearablesStep({
  userId,
  healthSourceName,
  healthSourceBody,
  healthConnecting,
  healthConnectNote,
  connected,
  onConnect,
  onContinue,
  onSkip,
  onSynced,
}: {
  userId: string | null;
  healthSourceName: string;
  healthSourceBody: string;
  healthConnecting: boolean;
  healthConnectNote: string | null;
  connected: boolean;
  onConnect: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onSynced: () => void;
}) {
  const [syncOpen, setSyncOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const source = WEARABLE_SOURCES.find((row) => row.id === sourceId) ?? null;

  return (
    <StepFrame>
      <Text style={styles.title}>Wearables and apps.</Text>
      <Text style={styles.subtitle}>{healthSourceBody}</Text>
      <Text style={styles.sectionLabel}>WHAT CAN BE COLLECTED</Text>
      {HEALTH_SOURCE_DATA_POINTS.map((line) => (
        <Text key={line} style={styles.inlineBullet}>
          {`• ${line}`}
        </Text>
      ))}
      {healthConnectNote ? (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.note}>{displayCopy(healthConnectNote)}</Text>
          {healthConnectNote.startsWith("Health Connect isn't installed") ? (
            <GhostButton
              label="Open Play Store"
              tone="ink"
              onPress={() =>
                Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() =>
                  Linking.openURL(
                    'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'
                  )
                )
              }
            />
          ) : null}
        </View>
      ) : null}
      <Text style={styles.sectionLabel}>CONNECTED SOURCES</Text>
      <Group>
        {WEARABLE_SOURCES.map((row, i) => (
          <DisclosureRow
            key={row.id}
            label={row.label}
            value={connected ? 'Through Health' : 'Not connected'}
            last={i === WEARABLE_SOURCES.length - 1}
            onPress={() => setSourceId(row.id)}
          />
        ))}
      </Group>
      <View style={{ flex: 1 }} />
      <PrimaryButton
        label={connected ? 'Continue' : `Connect ${healthSourceName}`}
        onPress={connected ? onContinue : userId ? () => setSyncOpen(true) : onConnect}
        loading={healthConnecting}
      />
      {!connected ? <GhostButton label={SKIP_LABEL} onPress={onSkip} /> : null}
      <HealthSyncSheet
        visible={syncOpen}
        userId={userId}
        connected={connected}
        onClose={() => setSyncOpen(false)}
        onSynced={() => {
          onSynced();
          setSyncOpen(false);
        }}
      />
      <BottomSheet visible={!!source} onClose={() => setSourceId(null)}>
        {source ? (
          <>
            <Text style={styles.sheetTitle}>{source.label}</Text>
            <Text style={styles.sheetBody}>{source.data}</Text>
            <Text style={styles.sheetBody}>
              Connect {healthSourceName} to bring this in when the app shares with it. That is the
              same permission flow already used for sleep, activity, and heart health.
            </Text>
            <View style={{ marginTop: 20 }}>
              <PrimaryButton
                label={connected ? 'Continue' : `Connect ${healthSourceName}`}
                onPress={() => {
                  setSourceId(null);
                  if (connected) onContinue();
                  else if (userId) setSyncOpen(true);
                  else onConnect();
                }}
                loading={healthConnecting}
              />
            </View>
          </>
        ) : null}
      </BottomSheet>
    </StepFrame>
  );
}

export function CalendarStep({
  onAllow,
  onSkip,
}: {
  onAllow: () => void;
  onSkip: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function handleAllow() {
    setBusy(true);
    setNote(null);
    try {
      const result = await requestCalendarPermission();
      if (!result.granted) {
        setNote('Calendar access was not granted. You can continue without it, or try again.');
        return;
      }
      onAllow();
    } catch {
      setNote('Calendar access was not granted. You can continue without it, or try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepFrame>
      <Text style={styles.title}>Your days have context.</Text>
      <Text style={styles.subtitle}>
        Calendar access helps relate busy days, travel, and rest to how you sleep and feel. Event
        titles stay private. How full the day is helps the picture. Titles are not stored.
      </Text>
      <Text style={styles.privacy}>
        You can turn this off later. Nothing from your calendar is sold or shared.
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <View style={{ flex: 1 }} />
      <PrimaryButton label="Allow calendar access" onPress={handleAllow} loading={busy} />
      <GhostButton label={SKIP_LABEL} onPress={onSkip} />
    </StepFrame>
  );
}

export function NotificationsStep({
  onAllow,
  onSkip,
}: {
  onAllow: () => void;
  onSkip: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleAllow() {
    setBusy(true);
    try {
      await Notifications.requestPermissionsAsync();
    } catch {
      /* Permission is optional. Onboarding continues either way. */
    } finally {
      setBusy(false);
      onAllow();
    }
  }

  return (
    <StepFrame>
      <Text style={styles.title}>A few useful reminders.</Text>
      <Text style={styles.subtitle}>
        Notifications stay limited to reminders that help, and updates that matter for your picture.
        You choose whether to turn them on, and you can change this later in You.
      </Text>
      <View style={{ flex: 1 }} />
      <PrimaryButton label="Allow notifications" onPress={handleAllow} loading={busy} />
      <GhostButton label="Not now" onPress={onSkip} />
    </StepFrame>
  );
}

export function PoliciesStep({
  agreed,
  onToggleAgree,
  onContinue,
}: {
  agreed: boolean;
  onToggleAgree: () => void;
  onContinue: () => void;
}) {
  return (
    <StepFrame>
      <Text style={styles.title}>How your data is used.</Text>
      <Text style={styles.subtitle}>
        Everything in your understanding is yours. Take a full copy with you later, or delete it
        completely, from You. We use what you share to help you make sense of what changes. We do
        not sell it.
      </Text>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        onPress={onToggleAgree}
        style={styles.agreeRow}
      >
        <View style={[styles.checkbox, agreed && styles.checkboxOn]} />
        <Text style={styles.agreeText}>
          I agree to the Privacy Policy and Terms of Service.
        </Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      <PrimaryButton label="Continue" onPress={onContinue} disabled={!agreed} />
    </StepFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
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
    marginBottom: 22,
  },
  sectionLabel: {
    ...fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
    marginTop: 22,
    marginBottom: 10,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 40,
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  note: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 14,
  },
  privacy: {
    ...fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink3,
    marginTop: 16,
  },
  bullet: {
    ...fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
    marginTop: 10,
  },
  inlineBullet: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink,
    marginBottom: 4,
  },
  sheetTitle: {
    ...type.title2,
    color: colors.ink,
  },
  sheetBody: {
    ...fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 12,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    marginTop: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink3,
  },
  checkboxOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  agreeText: {
    ...type.subheadline,
    color: colors.ink,
    flex: 1,
  },
});
