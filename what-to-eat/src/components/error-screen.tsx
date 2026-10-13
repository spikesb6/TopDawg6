import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/wordmark';
import { useTheme } from '@/hooks/use-theme';
import { reportError } from '@/lib/monitoring';
import { borderWidth, fonts, palette, radius } from '@/theme/theme';

/** Shown instead of a blank screen when something breaks. The crash goes to Sentry. */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background, paddingTop: insets.top + 40 }]}>
      <Wordmark scale={0.6} />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        Oops, we dropped the plate
      </Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        Something went wrong on our side. Give it another go.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={retry}
        style={({ pressed }) => [
          styles.button,
          { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
        ]}>
        <Text style={styles.buttonLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    marginTop: 32,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: 8,
  },
  button: {
    marginTop: 28,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth,
    borderRadius: radius.button,
    backgroundColor: palette.sunny,
  },
  buttonLabel: {
    fontFamily: fonts.heading,
    fontSize: 19,
    color: palette.ink,
  },
});
