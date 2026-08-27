import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import GlassSurface, { useLiquidGlass } from './GlassSurface';

export default function Avatar({
  initial,
  onPress,
  size = 40,
  tone = 'accent',
}: {
  initial: string;
  onPress?: () => void;
  size?: number;
  tone?: 'accent' | 'ink';
}) {
  const native = useLiquidGlass();
  const ink = tone === 'ink';
  const letter = (
    <Text style={[styles.letter, { fontSize: size * 0.4 }, ink && styles.letterInk]}>
      {initial}
    </Text>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? 'Profile' : undefined}
      hitSlop={onPress ? 4 : undefined}
    >
      {ink ? (
        <View
          style={[
            styles.circle,
            styles.inkFill,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          {letter}
        </View>
      ) : (
        <GlassSurface
          kind="regular"
          interactive={!!onPress}
          tintColor={colors.accent}
          colorScheme="light"
          style={[
            styles.circle,
            { width: size, height: size, borderRadius: size / 2 },
            native && styles.clearFill,
          ]}
          fallbackStyle={styles.fallback}
        >
          {letter}
        </GlassSurface>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  clearFill: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  fallback: {
    backgroundColor: colors.accent,
    borderWidth: 0,
  },
  inkFill: {
    backgroundColor: colors.ink,
  },
  letter: {
    ...fonts.serif,
    color: colors.onAccent,
  },
  letterInk: {
    color: colors.white,
  },
});
