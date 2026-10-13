import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Wordmark } from '@/components/wordmark';
import { useTheme } from '@/hooks/use-theme';

/** Back button on the left, the small crooked wordmark on the right. */
export function ScreenHeader() {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={({ pressed }) => [
          styles.back,
          { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
        ]}>
        <Icon name="chevronLeft" color={theme.text} size={22} strokeWidth={2.5} />
      </Pressable>
      <Wordmark scale={0.42} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
