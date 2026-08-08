import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import type { EvidenceRow } from '../lib/types';
import { ArrowDownIcon, ArrowUpIcon } from './icons';

export default function EvidenceList({ rows }: { rows: EvidenceRow[] }) {
  return (
    <View>
      {rows.map((row, i) => (
        <View
          key={row.label}
          style={[styles.row, i < rows.length - 1 && styles.divider]}
        >
          <Text style={styles.label}>{row.label}</Text>
          <View style={styles.valueCol}>
            <View style={styles.valueRow}>
              {row.direction === 'up' && <ArrowUpIcon />}
              {row.direction === 'down' && <ArrowDownIcon />}
              <Text style={styles.value}>{row.value}</Text>
            </View>
            <Text style={styles.context}>{row.context}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    color: colors.ink,
  },
  valueCol: {
    alignItems: 'flex-end',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontFamily: fonts.sansMedium,
    fontSize: 14.5,
    color: colors.ink,
  },
  context: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.ink3,
    marginTop: 2,
  },
});
