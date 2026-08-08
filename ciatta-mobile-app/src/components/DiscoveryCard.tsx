import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import type { Discovery } from '../lib/types';
import Card from './Card';
import ConfidenceBar from './ConfidenceBar';

export default function DiscoveryCard({
  discovery,
  onPress,
  compact,
}: {
  discovery: Discovery;
  onPress?: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Card onPress={onPress}>
        <Text style={styles.compactTitle}>{discovery.name}</Text>
        <Text style={styles.compactDate}>Discovered {discovery.discoveredAt}</Text>
      </Card>
    );
  }
  return (
    <Card onPress={onPress}>
      <Text style={styles.eyebrow}>YOUR DISCOVERY</Text>
      <Text style={styles.title}>{discovery.name}</Text>
      <Text style={styles.date}>First discovered {discovery.discoveredAt}</Text>
      <View style={styles.narrativeBox}>
        <Text style={styles.narrative}>{discovery.narrative}</Text>
        <Text style={styles.detail}>{discovery.detail}</Text>
      </View>
      <ConfidenceBar value={discovery.confidence} label={discovery.confidenceLabel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 10,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.ink,
  },
  date: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink3,
    marginTop: 6,
  },
  narrativeBox: {
    marginTop: 18,
    backgroundColor: colors.canvas,
    borderRadius: 14,
    padding: 16,
  },
  narrative: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 23,
    color: colors.ink,
  },
  detail: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink2,
    marginTop: 8,
  },
  compactTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.ink,
  },
  compactDate: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink3,
    marginTop: 4,
  },
});
