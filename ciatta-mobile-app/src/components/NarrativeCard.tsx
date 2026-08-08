import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import Card from './Card';

export default function NarrativeCard({
  eyebrow,
  headline,
  body,
  onPress,
}: {
  eyebrow?: string;
  headline: string;
  body?: string;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.headline}>{headline}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.accent,
    marginBottom: 8,
  },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink2,
    marginTop: 8,
  },
});
