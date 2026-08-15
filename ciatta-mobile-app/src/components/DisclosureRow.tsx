import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { ChevronIcon, DotIcon } from './icons';

export default function DisclosureRow({
  label,
  value,
  onPress,
  dot,
  last,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  dot?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint="Opens for editing"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divider,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.right}>
        {value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {dot ? <DotIcon size={7} /> : null}
        <ChevronIcon />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    flex: 1,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    color: colors.ink,
    marginRight: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    maxWidth: '48%',
  },
  value: {
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink3,
    textAlign: 'right',
  },
});
