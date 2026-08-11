import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export default function ConfidenceBar({
  value,
  label,
  showEndpoints,
}: {
  value: number;
  label?: string;
  showEndpoints?: boolean;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>HOW CONFIDENT AM I?</Text>
        {label ? <Text style={styles.pct}>{value}%</Text> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, value))}%` }]} />
      </View>
      {showEndpoints ? (
        <View style={styles.endpoints}>
          <Text style={styles.endpointText}>Low</Text>
          <Text style={styles.endpointTextMid}>{label}</Text>
          <Text style={styles.endpointText}>High</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
  },
  pct: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.evidence,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.evidence,
    borderRadius: 3,
  },
  endpoints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  endpointText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.ink3,
  },
  endpointTextMid: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.ink,
  },
});
