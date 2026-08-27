import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
  type GlassColorScheme,
  type GlassEffectStyleConfig,
  type GlassStyle,
} from 'expo-glass-effect';
import { shouldRenderNativeGlass } from '../lib/liquidGlass';
import { glass } from '../theme/tokens';

export type GlassKind = 'regular' | 'clear';

export function useLiquidGlass(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [liquidAvailable, apiAvailable] = useMemo(() => {
    if (Platform.OS !== 'ios') return [false, false] as const;
    try {
      return [isLiquidGlassAvailable(), isGlassEffectAPIAvailable()] as const;
    } catch {
      return [false, false] as const;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((enabled) => {
      if (alive) setReduceTransparency(!!enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceTransparencyChanged',
      (enabled) => setReduceTransparency(!!enabled)
    );
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  return shouldRenderNativeGlass({
    platform: Platform.OS,
    liquidAvailable,
    apiAvailable,
    reduceTransparency,
  });
}

type GlassSurfaceProps = ViewProps & {
  children?: React.ReactNode;
  kind?: GlassKind;
  interactive?: boolean;
  tintColor?: string;
  colorScheme?: GlassColorScheme;
  fallbackStyle?: StyleProp<ViewStyle>;
  animateStyle?: boolean;
};

/**
 * The app's one Liquid Glass material. On iOS 26 it renders UIGlassEffect
 * via expo-glass-effect. Everywhere else (and when Reduce Transparency is
 * on) it uses a solid Ciatta surface — not a fake blur.
 */
export default function GlassSurface({
  children,
  style,
  kind = 'regular',
  interactive = false,
  tintColor,
  colorScheme = 'light',
  fallbackStyle,
  animateStyle = false,
  ...rest
}: GlassSurfaceProps) {
  const native = useLiquidGlass();
  const glassEffectStyle: GlassStyle | GlassEffectStyleConfig = animateStyle
    ? { style: kind, animate: true }
    : kind;
  // Plate is always the Ciatta surface (or an explicit tint). Glass then
  // samples this plate instead of the warm canvas, figure glow, or domain
  // washes sitting underneath.
  const backing =
    tintColor && tintColor !== 'transparent' ? tintColor : glass.tint;

  if (native) {
    return (
      <View {...rest} style={[styles.plate, style, { backgroundColor: backing }]}>
        <GlassView
          pointerEvents="none"
          glassEffectStyle={glassEffectStyle}
          isInteractive={interactive}
          tintColor={backing}
          colorScheme={colorScheme}
          style={styles.glassLayer}
        />
        {children}
      </View>
    );
  }

  return (
    <View {...rest} style={[styles.fallback, fallbackStyle, style]}>
      {children}
    </View>
  );
}

export function GlassGroup({
  spacing = 8,
  style,
  children,
}: {
  spacing?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const native = useLiquidGlass();
  if (!native) {
    return <View style={style}>{children}</View>;
  }
  return (
    <GlassContainer spacing={spacing} style={style}>
      {children}
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  plate: {
    overflow: 'hidden',
  },
  glassLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    backgroundColor: glass.fillSolid,
    borderWidth: 1,
    borderColor: glass.border,
  },
});
