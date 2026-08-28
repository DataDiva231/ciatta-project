import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from '../theme/tokens';
import BottomSheet from '../components/BottomSheet';
import PrimaryButton from '../components/PrimaryButton';
import StatRow from '../components/StatRow';
import { connectHealthConnect } from '../lib/healthConnect';
import { connectHealthKit } from '../lib/healthKit';
import { fetchSyncReflection, formatSleepMinutes, type SyncReflection } from '../lib/observations';
import type { HealthKitSyncProgress, HealthKitSyncTelemetry } from '../lib/healthKitSync';

const SOURCE_NAME = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';

type SyncOutcome =
  | { kind: 'synced'; count: number; reflection: SyncReflection; telemetry?: HealthKitSyncTelemetry }
  | { kind: 'unavailable' }
  | { kind: 'permission-denied' }
  | { kind: 'error'; message: string };

function reflectionRows(reflection: SyncReflection): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (reflection.sleepMinutes != null) {
    rows.push({ label: 'Sleep, last night', value: formatSleepMinutes(reflection.sleepMinutes) });
  }
  if (reflection.steps != null) {
    rows.push({ label: 'Steps, last 24h', value: reflection.steps.toLocaleString() });
  }
  if (reflection.restingHeartRateBpm != null) {
    rows.push({
      label: 'Resting heart rate',
      value: `${Math.round(reflection.restingHeartRateBpm)} bpm`,
    });
  }
  return rows;
}

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
  const [progress, setProgress] = useState<HealthKitSyncProgress | null>(null);

  function handleClose() {
    setOutcome(null);
    onClose();
  }

  async function handleSync() {
    if (!userId) return;
    setSyncing(true);
    setOutcome(null);
    setProgress(null);
    try {
      const result =
        Platform.OS === 'android'
          ? await connectHealthConnect(userId)
          : await connectHealthKit(userId, setProgress);
      if (!result.granted) {
        setOutcome(
          result.reason === 'unavailable' ? { kind: 'unavailable' } : { kind: 'permission-denied' }
        );
        return;
      }
      const reflection = await fetchSyncReflection(userId);
      setOutcome({
        kind: 'synced',
        count: result.observationsSynced,
        reflection,
        telemetry: 'telemetry' in result ? result.telemetry : undefined,
      });
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
            ? `${SOURCE_NAME} is connected. Sync any time to pull in what's changed since last time. The more days that accumulate, the clearer the picture gets.`
            : `Connect ${SOURCE_NAME} to bring in your activity, heart rate, sleep, breathing, cycle history, workouts, and body measurements without asking the same questions twice.`}
        </Text>

        <View style={styles.section}>
          <PrimaryButton
            label={connected ? 'Sync now' : `Connect ${SOURCE_NAME}`}
            onPress={handleSync}
            loading={syncing}
          />
          {syncing && progress ? (
            <Text style={styles.result}>
              {progress.phase === 'write'
                ? `Saving ${progress.samplesFetched} readings`
                : `Reading Apple Health (${progress.typesDone} of ${progress.typesTotal})`}
            </Text>
          ) : null}

          {outcome?.kind === 'synced' && (
            <>
              <Text style={styles.result}>
                {outcome.count > 0
                  ? `Pulled in ${outcome.count} new reading${outcome.count === 1 ? '' : 's'}.`
                  : outcome.telemetry?.incremental
                    ? 'No new readings since last time.'
                    : Platform.OS === 'ios'
                      ? 'Apple Health had no readings to pull. The iOS Simulator does not store Health data. On a physical iPhone, open Health permissions for Ciatta and sync again.'
                      : 'Health Connect had no readings to pull. More can take shape the next time you sync.'}
              </Text>
              {reflectionRows(outcome.reflection).length > 0 && (
                <View style={styles.reflection}>
                  {reflectionRows(outcome.reflection).map((row, i, arr) => (
                    <StatRow key={row.label} label={row.label} value={row.value} last={i === arr.length - 1} />
                  ))}
                </View>
              )}
              {__DEV__ && outcome.telemetry ? (
                <View style={styles.reflection}>
                  <StatRow label="HealthKit query" value={`${outcome.telemetry.healthKitQueryMs} ms`} />
                  <StatRow label="Samples fetched" value={String(outcome.telemetry.samplesFetched)} />
                  <StatRow label="Normalization" value={`${outcome.telemetry.normalizationMs} ms`} />
                  <StatRow label="Database write" value={`${outcome.telemetry.databaseWriteMs} ms`} />
                  <StatRow label="Intelligence" value={`${outcome.telemetry.intelligenceProcessingMs} ms`} />
                  <StatRow
                    label="Total"
                    value={`${outcome.telemetry.totalMs} ms`}
                    last
                  />
                </View>
              ) : null}
            </>
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
              Permission wasn't granted to read your health data. You can try again, or check your
              {Platform.OS === 'android' ? ' Health Connect' : ' Health app'} permissions for Ciatta.
            </Text>
          )}
          {outcome?.kind === 'error' && <Text style={styles.error}>{outcome.message}</Text>}
        </View>

        <Text style={styles.footnote}>
          Some patterns, like how your cycle relates to your resting heart rate, need at least a
          couple of weeks of data before anything meaningful can take shape. Syncing regularly is
          what gets there.
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...type.title2,
    color: colors.ink,
  },
  intro: {
    ...fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 10,
  },
  section: {
    marginTop: 26,
  },
  result: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.ink2,
    marginTop: 10,
    textAlign: 'center',
  },
  reflection: {
    marginTop: 18,
    paddingHorizontal: 4,
  },
  error: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 10,
    textAlign: 'center',
  },
  footnote: {
    ...fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.ink3,
    marginTop: 24,
  },
});
