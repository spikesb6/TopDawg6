import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { useTheme } from '@/hooks/use-theme';
import { fonts, linkHitSlop, spacing } from '@/theme/theme';

type Props = {
  children: ReactNode;
  /** Shows a back link at the top (for screens pushed over the tabs). */
  back?: boolean;
};

export function Screen({ children, back }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingTop: insets.top + (back ? 8 : 20), paddingBottom: insets.bottom + 40 }]}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={linkHitSlop}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}>
          <Icon name="chevronLeft" color={theme.accent} size={22} />
          <Text style={[styles.backText, { color: theme.accent }]}>Back</Text>
        </Pressable>
      )}
      <View style={styles.stack}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.screen },
  stack: { gap: 14 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.bodySemi, fontSize: 16 },
});
