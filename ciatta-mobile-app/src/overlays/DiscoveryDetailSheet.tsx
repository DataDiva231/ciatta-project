import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import type { DiscoveryRow } from '../lib/queries';
import BottomSheet from '../components/BottomSheet';
import ConfidenceBar from '../components/ConfidenceBar';

// Read-only — naming happens once, in DiscoveryFlow. This is just for
// looking back at a discovery you've already named (or a pending one you
// want to re-read before deciding).
export default function DiscoveryDetailSheet({
  discovery,
  onClose,
}: {
  discovery: DiscoveryRow | null;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={!!discovery} onClose={onClose}>
      {discovery ? (
        <View>
          <Text style={styles.eyebrow}>
            {discovery.status === 'pending' ? 'AWAITING A NAME' : 'YOUR DISCOVERY'}
          </Text>
          <Text style={styles.name}>{discovery.name ?? 'A new discovery'}</Text>
          <Text style={styles.date}>
            First discovered{' '}
            {new Date(discovery.discovered_at).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <View style={styles.box}>
            <Text style={styles.narrative}>{discovery.narrative}</Text>
            {discovery.detail ? <Text style={styles.detail}>{discovery.detail}</Text> : null}
          </View>
          {discovery.confidence !== null ? (
            <ConfidenceBar
              value={Math.round(discovery.confidence * 100)}
              label={discovery.confidence_label ?? undefined}
            />
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
  },
  name: {
    fontFamily: fonts.serif,
    fontSize: 28,
    color: colors.ink,
    marginTop: 8,
  },
  date: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink3,
    marginTop: 6,
  },
  box: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
  },
  narrative: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 25,
    color: colors.ink,
  },
  detail: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.ink2,
    marginTop: 10,
  },
});
