import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii } from '../theme/tokens';
import {
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
  SocialAuthCancelled,
} from '../lib/socialAuth';

/**
 * Apple and Google sign-in, above the email/password form. `onAuthed`
 * receives the name the provider gave us (Apple only ever supplies this on
 * the very first authorization) so the caller can seed the profile with it.
 */
export default function SocialAuthButtons({
  onAuthed,
  onError,
}: {
  onAuthed: (fullName: string | null) => void;
  onError: (message: string) => void;
}) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    let active = true;
    isAppleSignInAvailable().then((ok) => {
      if (active) setAppleAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  async function run(provider: 'apple' | 'google') {
    if (busy) return;
    setBusy(provider);
    try {
      const result = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
      onAuthed(result.fullName);
    } catch (e) {
      // A deliberate cancel isn't an error worth surfacing.
      if (e instanceof SocialAuthCancelled) return;
      onError(e instanceof Error ? e.message : 'That sign-in did not go through.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.wrap}>
      {appleAvailable ? (
        <Pressable
          onPress={() => run('apple')}
          disabled={busy !== null}
          style={({ pressed }) => [
            styles.button,
            styles.appleButton,
            pressed && styles.pressed,
            busy !== null && styles.disabled,
          ]}
        >
          {busy === 'apple' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.appleMark}></Text>
              <Text style={[styles.label, styles.appleLabel]}>Continue with Apple</Text>
            </>
          )}
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => run('google')}
        disabled={busy !== null}
        style={({ pressed }) => [
          styles.button,
          styles.googleButton,
          pressed && styles.pressed,
          busy !== null && styles.disabled,
        ]}
      >
        {busy === 'google' ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <>
            <GoogleMark />
            <Text style={[styles.label, styles.googleLabel]}>Continue with Google</Text>
          </>
        )}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.rule} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.rule} />
      </View>
    </View>
  );
}

/**
 * Google's brand guidelines require their four-colour mark rather than a
 * recoloured glyph, so it's drawn inline instead of pulled from the icon set.
 */
function GoogleMark() {
  return (
    <View style={styles.googleMark}>
      <View style={[styles.googleQuad, { backgroundColor: '#EA4335', top: 0, left: 0 }]} />
      <View style={[styles.googleQuad, { backgroundColor: '#4285F4', top: 0, right: 0 }]} />
      <View style={[styles.googleQuad, { backgroundColor: '#34A853', bottom: 0, right: 0 }]} />
      <View style={[styles.googleQuad, { backgroundColor: '#FBBC05', bottom: 0, left: 0 }]} />
      <View style={styles.googleHole} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: radii.pill,
    marginBottom: 10,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.6,
  },
  appleButton: {
    backgroundColor: colors.ink,
  },
  googleButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
  },
  appleLabel: {
    color: colors.white,
  },
  googleLabel: {
    color: colors.ink,
  },
  appleMark: {
    color: colors.white,
    fontSize: 17,
    marginTop: Platform.OS === 'ios' ? -2 : 0,
  },
  googleMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
  },
  googleQuad: {
    position: 'absolute',
    width: 9,
    height: 9,
  },
  googleHole: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 18,
  },
  rule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink3,
  },
});
