import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, glass, type } from '../theme/tokens';
import GlassSurface, { GlassGroup } from './GlassSurface';
import GlassChip from './GlassChip';

export default function CuriosityCard({
  question,
  purpose,
  options,
  onAnswer,
  variant = 'light',
}: {
  question: string;
  purpose?: string;
  options: string[];
  onAnswer?: (answer: string) => void;
  variant?: 'dark' | 'light';
}) {
  const dark = variant === 'dark';

  return (
    <GlassSurface
      kind="regular"
      tintColor={dark ? colors.dark : colors.surface}
      colorScheme={dark ? 'dark' : 'auto'}
      style={[styles.card, dark && styles.cardDark]}
      fallbackStyle={[styles.fallback, dark && styles.fallbackDark]}
    >
      <Text style={[styles.eyebrow, dark && styles.eyebrowDark]}>
        ONE QUESTION FOR YOU
      </Text>
      <Text style={[styles.question, dark && styles.questionDark]}>{question}</Text>
      {purpose ? (
        <Text style={[styles.purpose, dark && styles.purposeDark]}>{purpose}</Text>
      ) : null}
      <GlassGroup spacing={8} style={styles.options}>
        {options.map((opt) => (
          <GlassChip key={opt} label={opt} onPress={() => onAnswer?.(opt)} />
        ))}
      </GlassGroup>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: glass.radiusCard,
    padding: 16,
  },
  cardDark: {
    backgroundColor: 'transparent',
  },
  fallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: glass.border,
    borderRadius: glass.radiusCard,
  },
  fallbackDark: {
    backgroundColor: colors.dark,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  eyebrow: {
    ...type.label,
    letterSpacing: 1,
    color: colors.ink3,
    marginBottom: 10,
  },
  eyebrowDark: {
    color: 'rgba(255,255,255,0.55)',
  },
  question: {
    ...type.title2,
    color: colors.ink,
  },
  questionDark: {
    color: colors.white,
  },
  purpose: {
    ...type.footnote,
    color: colors.ink2,
    marginTop: 8,
  },
  purposeDark: {
    color: 'rgba(255,255,255,0.55)',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
});
