// "Field Notes" palette — a specimen-card paper, not a latte-cream one, with
// two accents that split labor instead of one color doing everything:
// `accent` (a deep wine, not orange-coral) marks actions and moments that
// matter; `evidence` (a muted moss) marks anything measured or proven, so a
// button and a confidence tag never compete for the same color.
export const colors = {
  canvas: '#EDE6D8',
  surface: '#F6F1E6',
  border: '#DCD0B8',
  ink: '#2A2118',
  ink2: '#6B5D4C',
  ink3: '#A69783',
  accent: '#8C3A44',
  accentSoft: 'rgba(140, 58, 68, 0.12)',
  accentSofter: 'rgba(140, 58, 68, 0.06)',
  evidence: '#6B7A55',
  evidenceSoft: 'rgba(107, 122, 85, 0.14)',
  evidenceSofter: 'rgba(107, 122, 85, 0.07)',
  dark: '#211712',
  darkSurface: '#2C201A',
  white: '#FFFFFF',
  silhouetteFill: 'rgba(167, 151, 131, 0.4)',
  silhouetteFillDark: 'rgba(243, 234, 221, 0.16)',
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
