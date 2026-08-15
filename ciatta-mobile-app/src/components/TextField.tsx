import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radii } from '../theme/tokens';
import { MicIcon } from './icons';

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
  return (
    <View style={[styles.wrap, focused && styles.focused, multiline && styles.multiline]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        style={styles.input}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {onMicPress ? (
        <View style={styles.mic} onTouchEnd={onMicPress}>
          <MicIcon />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    // Surface + a real border, so the field stays visible on canvas-coloured
    // screens. It used to be canvas-on-canvas with a transparent border,
    // which rendered as bare placeholder text with no visible input.
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  multiline: {
    borderRadius: radii.md,
    alignItems: 'flex-start',
    minHeight: 120,
    paddingVertical: 14,
  },
  focused: {
    borderColor: colors.accent,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.ink,
    padding: 0,
  },
  mic: {
    marginLeft: 8,
    padding: 4,
  },
});
