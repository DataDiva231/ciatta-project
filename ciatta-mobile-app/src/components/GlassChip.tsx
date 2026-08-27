import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, glass, radii, type } from '../theme/tokens';
import GlassSurface from './GlassSurface';

export default function GlassChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
    >
      <GlassSurface
        kind={selected ? 'regular' : 'clear'}
        interactive
        animateStyle
        tintColor={selected ? colors.ink : glass.tint}
        colorScheme="auto"
        style={styles.chip}
        fallbackStyle={[styles.fallback, selected && styles.fallbackSelected]}
      >
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
  },
  fallback: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
  },
  fallbackSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  label: {
    ...type.subheadline,
    fontWeight: '500',
    color: colors.ink,
  },
  labelSelected: {
    color: colors.white,
  },
});
