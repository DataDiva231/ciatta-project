import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { glass } from '../theme/tokens';

const PRESS_IN_MS = 120;
const PRESS_OUT_MS = 220;

/**
 * The app's one card surface. Everything on Today, Core and You renders
 * through it, so the frosted-glass treatment is defined here once.
 *
 * Deliberately a single view rather than the nav's two-layer sandwich: callers
 * pass margins and colour overrides through `style`, and splitting the layers
 * would apply those margins to the wrong one. That works because the top
 * highlight is inset horizontally past the corner radius, so it never needs
 * `overflow: hidden` to clip — which in turn leaves Android's elevation
 * shadow intact.
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

  if (!onPress) {
    return (
      <View style={[styles.card, style]}>
        <View pointerEvents="none" style={styles.topHighlight} />
        {children}
      </View>
    );
  }

  function animate(to: number, duration: number) {
    Animated.timing(scale, { toValue: to, duration, useNativeDriver: true }).start();
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => animate(0.985, PRESS_IN_MS)}
      onPressOut={() => animate(1, PRESS_OUT_MS)}
      style={({ pressed }) => [
        styles.card,
        style,
        pressed && styles.pressed,
      ]}
    >
      <Animated.View pointerEvents="box-none" style={{ transform: [{ scale }] }}>
        <View pointerEvents="none" style={styles.topHighlight} />
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glass.fillCard,
    borderRadius: glass.radiusCard,
    borderWidth: 1,
    borderColor: glass.border,
    padding: 18,
    shadowColor: glass.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  // Light catching the upper edge. Inset past the corner radius so the line
  // stops before the curve begins and needs no clipping.
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: glass.radiusCard * 0.6,
    right: glass.radiusCard * 0.6,
    height: 1,
    backgroundColor: glass.highlight,
  },
  pressed: {
    // Dim rather than repaint: callers such as the discovery nudge set their
    // own tinted background, and replacing it on press would flash it away.
    opacity: 0.9,
  },
});
