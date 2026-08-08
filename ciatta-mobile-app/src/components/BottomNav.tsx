import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/tokens';
import { CoreIcon, PersonIcon, SunIcon } from './icons';

export type MainTab = 'today' | 'core' | 'you';

const TABS: { id: MainTab; label: string; Icon: typeof SunIcon }[] = [
  { id: 'today', label: 'Today', Icon: SunIcon },
  { id: 'core', label: 'Core', Icon: CoreIcon },
  { id: 'you', label: 'You', Icon: PersonIcon },
];

export default function BottomNav({
  active,
  onChange,
}: {
  active: MainTab;
  onChange: (tab: MainTab) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        const color = isActive ? colors.accent : colors.ink3;
        return (
          <Pressable key={id} style={styles.tab} onPress={() => onChange(id)}>
            <Icon color={color} />
            <Text style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
  },
});
