import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, type } from '../theme/tokens';

export default function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  /** @deprecated All primary actions use charcoal. Kept so callers can drop the prop. */
  tone?: 'accent' | 'ink';
}) {
  const inert = !!disabled || !!loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: !!loading }}
      onPress={onPress}
      disabled={inert}
      style={style}
    >
      <View style={[styles.base, inert && styles.disabled]}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.pill,
    paddingVertical: 16,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: colors.white,
    ...type.headline,
  },
});
