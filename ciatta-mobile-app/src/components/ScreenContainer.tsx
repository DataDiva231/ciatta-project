import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, NAV_CLEARANCE } from '../theme/tokens';

export default function ScreenContainer({
  children,
  scroll = true,
  dark,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  dark?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bg = dark ? colors.dark : colors.canvas;
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
          // The nav floats above the content rather than sitting beside it, so
          // the scroll view has to reserve its own clearance or the last line
          // of every screen ends up underneath the glass.
          { paddingTop: insets.top + 20, paddingBottom: NAV_CLEARANCE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
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
});
