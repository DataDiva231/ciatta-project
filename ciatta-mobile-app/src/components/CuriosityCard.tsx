import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/tokens';

export default function CuriosityCard({
  question,
  purpose,
  options,
  onAnswer,
  variant = 'dark',
}: {
  question: string;
  purpose?: string;
  options: string[];
  onAnswer?: (answer: string) => void;
  variant?: 'dark' | 'light';
}) {
  const dark = variant === 'dark';
  return (
    <View style={[styles.card, dark ? styles.dark : styles.light]}>
      <Text style={[styles.eyebrow, dark && styles.eyebrowDark]}>
        ONE QUESTION FOR YOU
      </Text>
      <Text style={[styles.question, dark && styles.questionDark]}>{question}</Text>
      {purpose ? (
        <Text style={[styles.purpose, dark && styles.purposeDark]}>{purpose}</Text>
      ) : null}
      <View style={styles.options}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onAnswer?.(opt)}
            style={({ pressed }) => [
              styles.option,
              dark ? styles.optionDark : styles.optionLight,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.optionText, dark && styles.optionTextDark]}>
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    padding: 20,
  },
  dark: {
    backgroundColor: colors.dark,
  },
  light: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.accent,
    marginBottom: 10,
  },
  eyebrowDark: {
    color: colors.accent,
  },
  question: {
    fontFamily: fonts.serif,
    fontSize: 21,
    lineHeight: 27,
    color: colors.ink,
  },
  questionDark: {
    color: colors.white,
  },
  purpose: {
    fontFamily: fonts.sans,
    fontSize: 13,
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
  option: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
  },
  optionLight: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  optionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink,
  },
  optionTextDark: {
    color: colors.white,
  },
});
