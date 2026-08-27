import type { TextStyle } from 'react-native';

type AppleTextRamp =
  | 'caption2'
  | 'caption1'
  | 'footnote'
  | 'subheadline'
  | 'callout'
  | 'body'
  | 'headline'
  | 'title3'
  | 'title2'
  | 'title1'
  | 'largeTitle';

type TypeStyle = TextStyle & { dynamicTypeRamp?: AppleTextRamp };

// Ciatta MVP palette. Every hue in the product is one of these seven:
// White, Charcoal, Living Coral, Soft Amber, Sage, Ocean, Deep Plum.
// Secondary text, borders, and washes are Charcoal at reduced opacity —
// not additional colors.
export const colors = {
  canvas: '#FFFFFF',
  grouped: '#F2F2F7',
  surface: '#FFFFFF',
  wash: 'rgba(24, 24, 24, 0.04)',
  border: 'rgba(24, 24, 24, 0.12)',
  ink: '#181818',
  ink2: 'rgba(24, 24, 24, 0.64)',
  ink3: 'rgba(24, 24, 24, 0.45)',
  accent: '#F27D72',
  onAccent: '#181818',
  accentSoft: 'rgba(242, 125, 114, 0.12)',
  accentSofter: 'rgba(242, 125, 114, 0.06)',
  // Measured/confidence chrome sits in Charcoal, not a domain color.
  evidence: '#181818',
  evidenceSoft: 'rgba(24, 24, 24, 0.08)',
  evidenceSofter: 'rgba(24, 24, 24, 0.04)',
  dark: '#181818',
  darkSurface: '#181818',
  white: '#FFFFFF',
  silhouetteFill: 'rgba(24, 24, 24, 0.28)',
  silhouetteFillDark: 'rgba(255, 255, 255, 0.16)',
} as const;

// Domain constellation hues. The product still has five domains; names in
// comments are the living vocabulary the figure is coloured against.
export const domainColor = {
  cycle: '#F27D72', // Hormones
  energy: '#F6C76B', // Metabolism
  recovery: '#6AA5CB', // Recovery
  sleep: '#5B4B7A', // Sleep
  mood: '#181818', // Mood
} as const;

// SF Pro (the iOS system face). No fontFamily is set so UIKit applies
// San Francisco with optical sizing (Text vs Display) from point size.
// Weight is the only axis — same roles the previous family split used.
type Face = Pick<TextStyle, 'fontWeight' | 'fontStyle' | 'fontVariant'>;

export const fonts = {
  serif: { fontWeight: '600' } satisfies Face,
  serifSemiBold: { fontWeight: '700' } satisfies Face,
  serifItalic: { fontWeight: '400', fontStyle: 'italic' } satisfies Face,
  sans: { fontWeight: '400' } satisfies Face,
  sansMedium: { fontWeight: '500' } satisfies Face,
  sansSemiBold: { fontWeight: '600' } satisfies Face,
  mono: { fontWeight: '400', fontVariant: ['tabular-nums'] } satisfies Face,
  monoBold: { fontWeight: '600', fontVariant: ['tabular-nums'] } satisfies Face,
};

// Apple semantic text styles at the default (Large) Dynamic Type size.
// `dynamicTypeRamp` maps each role onto UIFontMetrics so SF Pro tracks the
// user's preferred content size the way system apps do.
export const type = {
  largeTitle: {
    ...fonts.serif,
    fontSize: 34,
    lineHeight: 41,
    dynamicTypeRamp: 'largeTitle',
  } satisfies TypeStyle,
  title1: {
    ...fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    dynamicTypeRamp: 'title1',
  } satisfies TypeStyle,
  title2: {
    ...fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    dynamicTypeRamp: 'title2',
  } satisfies TypeStyle,
  title3: {
    ...fonts.serif,
    fontSize: 20,
    lineHeight: 25,
    dynamicTypeRamp: 'title3',
  } satisfies TypeStyle,
  headline: {
    ...fonts.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
    dynamicTypeRamp: 'headline',
  } satisfies TypeStyle,
  body: {
    ...fonts.sans,
    fontSize: 17,
    lineHeight: 22,
    dynamicTypeRamp: 'body',
  } satisfies TypeStyle,
  callout: {
    ...fonts.sans,
    fontSize: 16,
    lineHeight: 21,
    dynamicTypeRamp: 'callout',
  } satisfies TypeStyle,
  subheadline: {
    ...fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    dynamicTypeRamp: 'subheadline',
  } satisfies TypeStyle,
  footnote: {
    ...fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    dynamicTypeRamp: 'footnote',
  } satisfies TypeStyle,
  caption1: {
    ...fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    dynamicTypeRamp: 'caption1',
  } satisfies TypeStyle,
  caption2: {
    ...fonts.sans,
    fontSize: 11,
    lineHeight: 13,
    dynamicTypeRamp: 'caption2',
  } satisfies TypeStyle,
  label: {
    ...fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    dynamicTypeRamp: 'caption1',
  } satisfies TypeStyle,
  data: {
    ...fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    dynamicTypeRamp: 'footnote',
  } satisfies TypeStyle,
  dataLarge: {
    ...fonts.mono,
    fontSize: 17,
    lineHeight: 22,
    dynamicTypeRamp: 'body',
  } satisfies TypeStyle,
  // Aliases used by older call sites.
  displayLarge: {
    ...fonts.serif,
    fontSize: 34,
    lineHeight: 41,
    dynamicTypeRamp: 'largeTitle',
  } satisfies TypeStyle,
  displayMedium: {
    ...fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    dynamicTypeRamp: 'title1',
  } satisfies TypeStyle,
  displaySmall: {
    ...fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    dynamicTypeRamp: 'title2',
  } satisfies TypeStyle,
  bodySmall: {
    ...fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    dynamicTypeRamp: 'subheadline',
  } satisfies TypeStyle,
  caption: {
    ...fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    dynamicTypeRamp: 'caption1',
  } satisfies TypeStyle,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Native Liquid Glass (UIGlassEffect) is the material. These tokens only
// describe shape, identity tint, and the solid fallback used when the API
// is unavailable or Reduce Transparency is on — never a simulated blur.
export const glass = {
  radius: 32,
  radiusCard: 22,
  radiusControl: 999,
  fillCard: 'rgba(255, 255, 255, 0.86)',
  fill: 'rgba(255, 255, 255, 0.72)',
  fillSolid: '#FFFFFF',
  // Dedicated nav plate only. Canvas stays #FFFFFF. ~95% of #FAFAF8 so
  // scrolling copy cannot be read through the dock.
  navBacking: 'rgba(250, 250, 248, 0.95)',
  highlight: 'rgba(255, 255, 255, 0.92)',
  border: 'rgba(24, 24, 24, 0.08)',
  shadowColor: '#181818',
  tint: '#FFFFFF',
  activeFill: 'rgba(242, 125, 114, 0.12)',
  activeBorder: 'rgba(242, 125, 114, 0.2)',
} as const;

// How much room scrolling content must leave so its last line clears the
// floating nav. Exported so the dock and the screens can never drift apart.
export const NAV_CLEARANCE = 104;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

// Strength is how well-evidenced something is. It stays in Charcoal;
// domain color is reserved for which part of the body is being named.
export const strengthColor: Record<string, string> = {
  'very-strong': colors.ink,
  strong: 'rgba(24, 24, 24, 0.8)',
  moderate: 'rgba(24, 24, 24, 0.55)',
  emerging: colors.ink3,
};

export const strengthOpacity: Record<string, number> = {
  'very-strong': 1,
  strong: 0.8,
  moderate: 0.55,
  emerging: 0.32,
};
