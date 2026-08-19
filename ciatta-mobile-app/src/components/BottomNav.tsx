import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, glass, radii } from '../theme/tokens';
import { CoreIcon, PersonIcon, SunIcon } from './icons';

export type MainTab = 'today' | 'core' | 'you';

const TABS: { id: MainTab; label: string; Icon: typeof SunIcon }[] = [
  { id: 'today', label: 'Today', Icon: SunIcon },
  { id: 'core', label: 'Core', Icon: CoreIcon },
  { id: 'you', label: 'You', Icon: PersonIcon },
];

const PRESS_IN_MS = 120;
const PRESS_OUT_MS = 220;

function NavTab({
  label,
  Icon,
  isActive,
  onPress,
}: {
  label: string;
  Icon: typeof SunIcon;
  isActive: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = isActive ? colors.accent : colors.ink3;

  function animate(to: number, duration: number) {
    Animated.timing(scale, { toValue: to, duration, useNativeDriver: true }).start();
  }

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      onPressIn={() => animate(0.94, PRESS_IN_MS)}
      onPressOut={() => animate(1, PRESS_OUT_MS)}
      style={styles.tab}
    >
      <Animated.View
        style={[
          styles.tabInner,
          isActive && styles.tabInnerActive,
          { transform: [{ scale }] },
        ]}
      >
        <Icon color={color} />
        <Text style={[styles.label, { color }]}>{label}</Text>
        {/* Shape, not just hue: the active tab stays identifiable for anyone
            who can't separate wine from grey, and the translucent pill alone
            is too faint to carry that on its own. */}
        <View style={[styles.dot, isActive && styles.dotActive]} />
      </Animated.View>
    </Pressable>
  );
}

export default function BottomNav({
  active,
  onChange,
}: {
  active: MainTab;
  onChange: (tab: MainTab) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    // box-none so the dock's padding never swallows touches meant for the
    // content scrolling underneath it.
    <View
      pointerEvents="box-none"
      style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}
    >
      {/* Two layers on purpose: Android drops elevation shadows on any view
          with overflow:hidden, so the shadow lives out here and the clipping
          lives on the capsule inside. */}
      <View style={styles.shadowWrap}>
        <View style={styles.capsule}>
          <View pointerEvents="none" style={styles.topHighlight} />
          {TABS.map(({ id, label, Icon }) => (
            <NavTab
              key={id}
              label={label}
              Icon={Icon}
              isActive={active === id}
              onPress={() => onChange(id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
  },
  shadowWrap: {
    borderRadius: glass.radius,
    backgroundColor: 'transparent',
    shadowColor: glass.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: glass.radius,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    paddingVertical: 9,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: glass.radius * 0.5,
    right: glass.radius * 0.5,
    height: 1,
    backgroundColor: glass.highlight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 3,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabInnerActive: {
    backgroundColor: glass.activeFill,
    borderColor: glass.activeBorder,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
});
