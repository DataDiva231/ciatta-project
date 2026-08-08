import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import BodySilhouette from './BodySilhouette';

export default function EvolutionCard({
  label,
  caption,
  stage,
}: {
  label: string;
  caption: string;
  stage: 0 | 1 | 2 | 3;
}) {
  return (
    <View style={styles.wrap}>
      <BodySilhouette variant="mini" stage={stage} scale={0.16} animated={false} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 92,
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.ink,
    marginTop: 10,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 14,
  },
});
