import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { appleSignInAvailable } from '@/lib/auth';
import { useDinnerStore } from '@/store/dinner-store';
import { borderWidth, fonts, palette, radius } from '@/theme/theme';

/** Offered after the first fave, and from the account card on Faves. */
export function SignInSheet() {
  const theme = useTheme();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const { signInVisible, closeSignIn, signIn } = useDinnerStore();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appleSignInAvailable()
      .then(setApple)
      .catch(() => setApple(false));
  }, []);

  const run = async (provider: 'apple' | 'google') => {
    setBusy(true);
    setError(null);
    try {
      await signIn(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in did not work. Try again?');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setError(null);
    closeSignIn();
  };

  return (
    <Modal visible={signInVisible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.backdrop}
        onPress={close}
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.background, paddingBottom: insets.bottom + 20 },
        ]}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
          Keep your faves on every phone
        </Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          Sign in and your faves and past picks follow you.
        </Text>

        {apple && Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.button}
            style={styles.apple}
            onPress={() => !busy && run('apple')}
          />
        ) : apple ? (
          <BouncyPressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
            disabled={busy}
            onPress={() => run('apple')}
            style={[styles.button, { backgroundColor: theme.text, borderColor: theme.border }]}>
            <Text style={[styles.buttonLabel, { color: theme.background }]}>
              Continue with Apple
            </Text>
          </BouncyPressable>
        ) : null}

        <BouncyPressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          disabled={busy}
          tilt={-1}
          onPress={() => run('google')}
          style={[styles.button, { backgroundColor: palette.sunny, borderColor: theme.border }]}>
          <Text style={[styles.buttonLabel, { color: palette.ink }]}>Continue with Google</Text>
        </BouncyPressable>

        {error ? <Text style={[styles.error, { color: palette.tomato }]}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          onPress={close}
          style={styles.notNow}>
          <Text style={[styles.notNowLabel, { color: theme.text }]}>Not now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29, 18, 48, 0.45)',
  },
  sheet: {
    paddingHorizontal: 22,
    paddingTop: 26,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    gap: 12,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 26,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    marginBottom: 8,
  },
  apple: {
    height: 58,
  },
  button: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth,
    borderRadius: radius.button,
  },
  buttonLabel: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
  notNow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  notNowLabel: {
    fontFamily: fonts.headingSemi,
    fontSize: 16,
  },
});
