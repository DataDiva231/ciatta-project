import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, domainColor, fonts, strengthColor } from '../theme/tokens';
import { domainLabel, strengthShort } from '../lib/mockData';
import type { RelationshipRef } from '../lib/types';

export default function RelationshipList({
  relationships,
}: {
  relationships: RelationshipRef[];
}) {
  return (
    <View>
      {relationships.map((rel, i) => (
        <View
          key={rel.domain}
          style={[styles.row, i < relationships.length - 1 && styles.divider]}
        >
          <View style={styles.dotRow}>
            <View
              style={[styles.dot, { backgroundColor: domainColor[rel.domain] }]}
            />
            <Text style={styles.domain}>{domainLabel[rel.domain]}</Text>
          </View>
          <Text style={[styles.strength, { color: strengthColor[rel.strength] }]}>
            {strengthShort[rel.strength]}
          </Text>
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
    paddingVertical: 13,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  domain: {
    ...fonts.sans,
    fontSize: 14.5,
    color: colors.ink,
  },
  strength: {
    ...fonts.sansMedium,
    fontSize: 13,
  },
});
