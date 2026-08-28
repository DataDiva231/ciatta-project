import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, NAV_CLEARANCE } from '../theme/tokens';
import { useNavAdaptivity } from '../lib/navAdaptivityContext';

export default function ScreenContainer({
  children,
  scroll = true,
  dark,
  grouped,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  dark?: boolean;
  grouped?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { reportScroll } = useNavAdaptivity();
  const bg = dark ? colors.dark : grouped ? colors.grouped : colors.canvas;
  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: bg, paddingTop: insets.top }]}>
        {children}
      </View>
    );
  }
  return (
    <View style={[styles.flex, { backgroundColor: bg }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          grouped && styles.groupedContent,
          // The nav floats above the content rather than sitting beside it, so
          // the scroll view has to reserve its own clearance or the last line
          // of every screen ends up underneath the nav.
          { paddingTop: insets.top + 20, paddingBottom: NAV_CLEARANCE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => reportScroll(e.nativeEvent.contentOffset.y)}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 32,
  },
  groupedContent: {
    paddingHorizontal: 16,
  },
});
