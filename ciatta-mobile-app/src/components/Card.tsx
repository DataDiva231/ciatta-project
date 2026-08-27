import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, glass } from '../theme/tokens';
import GlassSurface, { useLiquidGlass } from './GlassSurface';

const PRESS_IN_MS = 120;
const PRESS_OUT_MS = 220;

function tintFrom(style?: ViewStyle): string {
  const bg = StyleSheet.flatten(style)?.backgroundColor;
  return bg != null && bg !== 'transparent' ? String(bg) : colors.surface;
}

/**
 * The app's one card surface. Native Liquid Glass on iOS 26; a solid Ciatta
 * surface everywhere else. A backgroundColor in `style` becomes a glass tint.
 */
export default function Card({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const native = useLiquidGlass();

  function animate(to: number, duration: number) {
    Animated.timing(scale, { toValue: to, duration, useNativeDriver: true }).start();
  }

  const material = (
    <GlassSurface
      kind="regular"
      interactive={!!onPress}
      tintColor={tintFrom(style)}
      colorScheme="auto"
      style={[styles.material, style, native && styles.clearFill]}
      fallbackStyle={styles.fallback}
    >
      {children}
    </GlassSurface>
  );

  if (!onPress) {
    return material;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => animate(0.985, PRESS_IN_MS)}
      onPressOut={() => animate(1, PRESS_OUT_MS)}
    >
      <Animated.View pointerEvents="box-none" style={{ transform: [{ scale }] }}>
        {material}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  material: {
    borderRadius: glass.radiusCard,
    padding: 18,
  },
  clearFill: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  fallback: {
    backgroundColor: glass.fillCard,
    borderRadius: glass.radiusCard,
    borderWidth: 1,
    borderColor: glass.border,
    shadowColor: glass.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
});
