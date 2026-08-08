import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { domainLabel, strengthLabel } from '../lib/mockData';
import type { Understanding } from '../lib/types';
import Card from './Card';
import { ChevronIcon } from './icons';

export default function UnderstandingCard({
  understanding,
  onPress,
}: {
  understanding: Understanding;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{domainLabel[understanding.domain]}</Text>
          <Text style={styles.sub}>{strengthLabel[understanding.strength]}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.count}>
            {understanding.observations} observations{'\n'}since {understanding.learningSince}
          </Text>
          <ChevronIcon />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    color: colors.ink,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: colors.ink2,
    marginTop: 3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  count: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.ink3,
    textAlign: 'right',
    lineHeight: 15,
  },
});
