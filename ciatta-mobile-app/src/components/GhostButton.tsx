import React from 'react';
import { Pressable, StyleSheet, Text, TextStyle } from 'react-native';
import { colors, type } from '../theme/tokens';

export default function GhostButton({
  label,
  onPress,
  tone = 'muted',
  style,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'muted' | 'ink' | 'light';
  style?: TextStyle;
}) {
  const color =
    tone === 'ink' ? colors.ink : tone === 'light' ? colors.white : colors.ink2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={styles.wrap}
    >
      {({ pressed }) => (
        <Text style={[styles.label, { color, opacity: pressed ? 0.6 : 1 }, style]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 44,
  },
  label: {
    ...type.subheadline,
    fontWeight: '500',
  },
});
