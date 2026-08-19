// "Field Notes" palette — a cool paper stock rather than a warm one, with two
// accents that split labor instead of one color doing everything: `accent`
// (a deep wine) marks actions and moments that matter; `evidence` (a muted
// moss) marks anything measured or proven, so a button and a confidence tag
// never compete for the same color.
//
// The neutral ramp is tuned against `canvas`, not chosen by eye: `ink3` is the
// eyebrow/label grey and clears 4.5:1 on this background, where the previous
// warm beige managed only 2.3:1 and failed for anyone reading in daylight.
export const colors = {
  canvas: '#F6F8FA',
  surface: '#FFFFFF',
  border: '#D7DEE6',
  ink: '#1B2127',
  ink2: '#55606B',
  ink3: '#646E79',
  accent: '#8C3A44',
  accentSoft: 'rgba(140, 58, 68, 0.12)',
  accentSofter: 'rgba(140, 58, 68, 0.06)',
  evidence: '#6B7A55',
  evidenceSoft: 'rgba(107, 122, 85, 0.14)',
  evidenceSofter: 'rgba(107, 122, 85, 0.07)',
  dark: '#171C22',
  darkSurface: '#232A32',
  white: '#FFFFFF',
  silhouetteFill: 'rgba(132, 145, 158, 0.4)',
  silhouetteFillDark: 'rgba(233, 238, 243, 0.16)',
} as const;

// Three roles, not two: a characterful display serif for narrative moments
// (Fraunces — used with restraint), a warm grotesk for UI and body copy
// (Karla), and a monospace reserved *only* for measured data — confidence
// scores, bpm, day counts, dates — so a number in this app always reads as
// evidence, never as decoration.
export const fonts = {
  serif: 'Fraunces_500Medium',
  serifSemiBold: 'Fraunces_600SemiBold',
  serifItalic: 'Fraunces_500Medium_Italic',
  sans: 'Karla_400Regular',
  sansMedium: 'Karla_500Medium',
  sansSemiBold: 'Karla_600SemiBold',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
} as const;

export const type = {
  displayLarge: { fontFamily: fonts.serif, fontSize: 38, lineHeight: 44 },
  displayMedium: { fontFamily: fonts.serif, fontSize: 29, lineHeight: 35 },
  displaySmall: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 28 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16 },
  data: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
  dataLarge: { fontFamily: fonts.mono, fontSize: 17, lineHeight: 22 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Frosted-glass surface tokens, kept together so the whole effect can be
// retuned from one place. React Native has no `backdrop-filter`, so "glass"
// here is layered translucency — a semi-opaque fill that lets scrolling
// content read through it, a luminous inner edge, and a soft outer shadow.
// Depth comes from stacking those three, never from a heavy drop shadow.
export const glass = {
  radius: 32,
  // Cards are smaller and appear many to a screen, so they carry a tighter
  // corner and a lighter shadow than the nav — the same material, less of it.
  radiusCard: 22,
  // Cards sit on a flat canvas with nothing moving behind them, so a
  // translucent fill bought no visible translucency — it only let Android's
  // elevation shadow bleed up through the surface and ring every card. This
  // is exactly what `fill` composited to over the canvas, minus the artifact.
  fillCard: '#FEFEFE',
  // Under 1.0 so content passing beneath still tints the surface — that is
  // what makes it read as glass rather than as a painted bar. Tuned to 0.88
  // because React Native has no `backdrop-filter`: without a real blur, a
  // thinner fill lets sharp text through and it competes with the nav labels.
  fill: 'rgba(255, 255, 255, 0.88)',
  // The bright inner hairline that catches "light" along the top edge.
  highlight: 'rgba(255, 255, 255, 0.95)',
  // Outer edge, tinted from ink rather than pure black so it stays in-palette.
  border: 'rgba(27, 33, 39, 0.07)',
  shadowColor: '#1B2127',
  // Active state: a translucent pill, not a solid fill.
  activeFill: 'rgba(140, 58, 68, 0.09)',
  activeBorder: 'rgba(140, 58, 68, 0.16)',
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

// Strength is fundamentally about how well-evidenced something is, not
// about prompting an action — so it lives in the evidence (moss) family,
// not the accent (wine) one. Wine is reserved for discoveries and CTAs;
// this is reserved for "here's how sure I am."
export const strengthColor: Record<string, string> = {
  'very-strong': colors.evidence,
  strong: '#8B9873',
  moderate: '#AEB79C',
  emerging: colors.ink3,
};

export const strengthOpacity: Record<string, number> = {
  'very-strong': 1,
  strong: 0.8,
  moderate: 0.55,
  emerging: 0.32,
};
