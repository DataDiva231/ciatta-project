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
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divider,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.right}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
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
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink3,
  },
});
