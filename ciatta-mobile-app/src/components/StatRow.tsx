import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export default function StatRow({
  label,
  value,
  last,
  valueColor,
}: {
  label: string;
  value: string;
  last?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink2,
  },
  value: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
  },
});
