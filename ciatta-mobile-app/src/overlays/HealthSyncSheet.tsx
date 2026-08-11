import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import BottomSheet from '../components/BottomSheet';
import PrimaryButton from '../components/PrimaryButton';
import { connectHealthConnect } from '../lib/healthConnect';
import { connectHealthKit } from '../lib/healthKit';

const SOURCE_NAME = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';

type SyncOutcome =
  | { kind: 'synced'; count: number }
  | { kind: 'unavailable' }
  | { kind: 'permission-denied' }
  | { kind: 'error'; message: string };

export default function HealthSyncSheet({
  visible,
  userId,
  connected,
  onClose,
  onSynced,
}: {
  visible: boolean;
  userId: string | null;
  connected: boolean;
  onClose: () => void;
  onSynced: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);

  function handleClose() {
    setOutcome(null);
    onClose();
  }

  async function handleSync() {
    if (!userId) return;
    setSyncing(true);
    setOutcome(null);
    try {
      const result =
        Platform.OS === 'android'
          ? await connectHealthConnect(userId)
          : await connectHealthKit(userId);
      if (!result.granted) {
        setOutcome(
          result.reason === 'unavailable' ? { kind: 'unavailable' } : { kind: 'permission-denied' }
        );
        return;
      }
      setOutcome({ kind: 'synced', count: result.observationsSynced });
      onSynced();
    } catch (e) {
      setOutcome({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View>
        <Text style={styles.title}>{SOURCE_NAME}</Text>
        <Text style={styles.intro}>
          {connected
            ? `${SOURCE_NAME} is connected. Sync any time to pull in what's changed since last time — the more days I have, the clearer the picture gets.`
            : `Connect ${SOURCE_NAME} to bring in your steps, heart rate, sleep, and cycle history without asking the same questions twice.`}
        </Text>

        <View style={styles.section}>
          <PrimaryButton
            label={connected ? 'Sync now' : `Connect ${SOURCE_NAME}`}
            onPress={handleSync}
            loading={syncing}
          />

          {outcome?.kind === 'synced' && (
            <Text style={styles.result}>
              {outcome.count > 0
                ? `Pulled in ${outcome.count} new reading${outcome.count === 1 ? '' : 's'}.`
                : `No new data since last time — I'll have more to work with the next time you sync.`}
            </Text>
          )}
          {outcome?.kind === 'unavailable' && (
            <Text style={styles.error}>
              {Platform.OS === 'android'
                ? "Health Connect isn't installed on this device yet. Install it from the Play Store, then come back and sync."
                : `${SOURCE_NAME} isn't available on this device.`}
            </Text>
          )}
          {outcome?.kind === 'permission-denied' && (
            <Text style={styles.error}>
              I wasn't given permission to read your health data. You can try again, or check your
              {Platform.OS === 'android' ? ' Health Connect' : ' Health app'} permissions for Ciatta.
            </Text>
          )}
          {outcome?.kind === 'error' && <Text style={styles.error}>{outcome.message}</Text>}
        </View>

        <Text style={styles.footnote}>
          Some patterns — like how your cycle relates to your resting heart rate — need at least a
          couple of weeks of data before I can say anything meaningful. Syncing regularly is what
          gets me there.
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.ink,
  },
  intro: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 10,
  },
  section: {
    marginTop: 26,
  },
  result: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink2,
    marginTop: 10,
    textAlign: 'center',
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 10,
    textAlign: 'center',
  },
  footnote: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink3,
    marginTop: 24,
  },
});
