import React, { useEffect, useRef } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, glass, type } from '../theme/tokens';
import { useNavAdaptivity } from '../lib/NavAdaptivity';
import { CoreIcon, PersonIcon, SunIcon } from './icons';
import GlassSurface, { useLiquidGlass } from './GlassSurface';

export type MainTab = 'today' | 'core' | 'you';

const TABS: { id: MainTab; label: string; Icon: typeof SunIcon }[] = [
  { id: 'today', label: 'Today', Icon: SunIcon },
  { id: 'core', label: 'Core', Icon: CoreIcon },
  { id: 'you', label: 'You', Icon: PersonIcon },
];

const PRESS_IN_MS = 120;
const PRESS_OUT_MS = 220;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function NavTab({
  label,
  Icon,
  isActive,
  compact,
  native,
  onPress,
}: {
  label: string;
  Icon: typeof SunIcon;
  isActive: boolean;
  compact: boolean;
  native: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const iconColor = isActive ? colors.accent : colors.ink3;
  const labelColor = isActive ? colors.ink : colors.ink3;

  function animate(to: number, duration: number) {
    Animated.timing(scale, { toValue: to, duration, useNativeDriver: true }).start();
  }

  const inner = (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      onPressIn={() => animate(0.94, PRESS_IN_MS)}
      onPressOut={() => animate(1, PRESS_OUT_MS)}
      style={styles.tabPress}
    >
      <Animated.View style={[styles.tabInner, compact && styles.tabInnerCompact, { transform: [{ scale }] }]}>
        <Icon color={iconColor} />
        {!compact ? <Text style={[styles.label, { color: labelColor }]}>{label}</Text> : null}
      </Animated.View>
    </Pressable>
  );

  if (!native) return inner;

  return (
    <GlassSurface
      kind={isActive ? 'regular' : 'clear'}
      interactive
      animateStyle
      colorScheme="auto"
      tintColor={colors.surface}
      style={[styles.tabGlass, compact && styles.tabGlassCompact]}
    >
      {inner}
    </GlassSurface>
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
  const native = useLiquidGlass();
  const { compact, expand } = useNavAdaptivity();
  const compactReady = useRef(false);

  useEffect(() => {
    if (!compactReady.current) {
      compactReady.current = true;
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [compact]);

  function select(id: MainTab) {
    if (id !== active) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      expand();
    }
    onChange(id);
  }

  const tabs = TABS.map(({ id, label, Icon }) => (
    <NavTab
      key={id}
      label={label}
      Icon={Icon}
      isActive={active === id}
      compact={compact}
      native={native}
      onPress={() => select(id)}
    />
  ));

  const barStyle = [styles.bar, compact && styles.barCompact];

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.dock,
        compact ? styles.dockCompact : styles.dockExpanded,
        { paddingBottom: Math.max(insets.bottom, 10) + 2 },
      ]}
    >
      {native ? (
        <GlassSurface
          kind="clear"
          colorScheme="light"
          tintColor={colors.surface}
          style={barStyle}
          accessibilityRole="tablist"
        >
          {tabs}
        </GlassSurface>
      ) : (
        <View style={styles.shadowWrap}>
          <View style={[styles.capsuleFallback, compact && styles.capsuleFallbackCompact]} accessibilityRole="tablist">
            {tabs}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  dockExpanded: {
    paddingHorizontal: 18,
  },
  dockCompact: {
    paddingHorizontal: 52,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 40,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  barCompact: {
    borderRadius: 28,
    paddingVertical: 2,
  },
  shadowWrap: {
    borderRadius: 40,
    backgroundColor: 'transparent',
    shadowColor: glass.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  capsuleFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 40,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: glass.fillSolid,
    borderWidth: 1,
    borderColor: glass.border,
    overflow: 'hidden',
  },
  capsuleFallbackCompact: {
    paddingVertical: 2,
  },
  tabGlass: {
    flex: 1,
    borderRadius: 32,
  },
  tabGlassCompact: {
    borderRadius: 24,
  },
  tabPress: {
    flex: 1,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 3,
    paddingVertical: 8,
  },
  tabInnerCompact: {
    paddingVertical: 6,
    gap: 0,
  },
  label: {
    ...type.caption2,
    fontWeight: '500',
  },
});
