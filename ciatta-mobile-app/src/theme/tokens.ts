export const colors = {
  canvas: '#FAF9F8',
  surface: '#FFFFFF',
  border: '#ECECEC',
  ink: '#101010',
  ink2: '#616161',
  ink3: '#B5B5B5',
  accent: '#F26A53',
  accentSoft: 'rgba(242, 106, 83, 0.12)',
  accentSofter: 'rgba(242, 106, 83, 0.06)',
  dark: '#141312',
  darkSurface: '#1F1D1C',
  white: '#FFFFFF',
  silhouetteFill: 'rgba(195, 178, 165, 0.36)',
  silhouetteFillDark: 'rgba(255, 255, 255, 0.14)',
} as const;

export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
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

export const strengthColor: Record<string, string> = {
  'very-strong': colors.accent,
  strong: '#E08769',
  moderate: '#C79A88',
  emerging: colors.ink3,
};

export const strengthOpacity: Record<string, number> = {
  'very-strong': 1,
  strong: 0.8,
  moderate: 0.55,
  emerging: 0.32,
};
