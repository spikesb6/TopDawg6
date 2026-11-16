import type { ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { Wordmark } from '@/components/wordmark';
import { useTheme } from '@/hooks/use-theme';
import { fonts } from '@/theme/theme';

/** Shown instead of a blank screen when something breaks. Saved progress is not touched. */
export function ErrorScreen({ retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background, paddingTop: insets.top + 40 }]}>
      <Wordmark size={40} />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Something broke on our side</Text>
      <Text style={[styles.body, { color: theme.muted }]}>Your build is saved. Try again.</Text>
      <Button kind="primary" label="Try again" onPress={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 26, marginTop: 20 },
  body: { fontFamily: fonts.body, fontSize: 16 },
});
