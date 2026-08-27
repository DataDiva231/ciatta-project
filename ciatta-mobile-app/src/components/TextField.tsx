import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, glass, radii, type } from '../theme/tokens';
import { MicIcon } from './icons';
import GlassSurface, { useLiquidGlass } from './GlassSurface';

export default function TextField({
  value,
  onChangeText,
  placeholder,
  onMicPress,
  multiline,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onMicPress?: () => void;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const native = useLiquidGlass();

  return (
    <GlassSurface
      kind={focused ? 'clear' : 'regular'}
      interactive
      tintColor={glass.tint}
      colorScheme="auto"
      animateStyle
      style={[
        styles.wrap,
        multiline && styles.multiline,
        native && styles.clearFill,
        !native && focused && styles.focused,
      ]}
      fallbackStyle={styles.fallback}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        style={styles.input}
        multiline={multiline}
        accessibilityLabel={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {onMicPress ? (
        <View style={styles.mic} onTouchEnd={onMicPress} accessibilityRole="button" accessibilityLabel="Dictate">
          <MicIcon />
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 44,
  },
  multiline: {
    borderRadius: radii.md,
    alignItems: 'flex-start',
    minHeight: 120,
    paddingVertical: 14,
  },
  clearFill: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  fallback: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  focused: {
    borderColor: colors.ink,
  },
  input: {
    flex: 1,
    ...type.body,
    fontSize: 17,
    color: colors.ink,
    padding: 0,
  },
  mic: {
    marginLeft: 8,
    padding: 4,
  },
});
