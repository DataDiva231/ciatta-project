import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, ViewStyle } from 'react-native';

/**
 * The one keyboard-avoidance primitive for the whole app. Any screen, sheet,
 * or overlay that contains a TextInput should wrap the part of its layout
 * that sits above the keyboard with this instead of reaching for a bare
 * KeyboardAvoidingView (or, worse, a screen-specific fudge) — that's how
 * three different keyboardVerticalOffset guesses ended up scattered across
 * the app, each tuned by eye for one screen and wrong everywhere else.
 *
 * iOS: 'padding' — grows this view's own bottom padding by however much the
 * keyboard is covering, which pushes its content up without resizing or
 * clipping anything above it. This is Apple's own recommended pattern for
 * exactly this situation, and it's what every keyboard-handling screen in
 * this app already used in some form — this component just makes that one
 * approach instead of several. No third-party keyboard library is needed on
 * top of it.
 * Android: 'height' — shrinks this view instead of padding it, which plays
 * correctly with Android's own soft-input handling (RN's 'padding' behavior
 * tends to double-compensate there).
 *
 * `keyboardVerticalOffset` defaults to 0 and should almost never be set —
 * it only matters when this view's top edge sits below something the
 * avoidance logic can't see for itself, which nothing in this app currently
 * does (there's no native nav/tab bar). Don't hand-tune it per screen; if a
 * real case needs it, the value should come from a measured layout (e.g. an
 * onLayout height), never a guessed constant.
 */
export default function KeyboardAvoidingScreen({
  children,
  style,
  keyboardVerticalOffset = 0,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  keyboardVerticalOffset?: number;
}) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
