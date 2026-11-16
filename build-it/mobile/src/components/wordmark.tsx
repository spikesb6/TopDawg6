import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { fonts } from '@/theme/theme';

export function Wordmark({ size = 52 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Build It">
      <Text style={[styles.word, { fontSize: size, lineHeight: size * 1.05, color: theme.text }]}>
        Build<Text style={{ color: theme.accent }}>It</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  word: { fontFamily: fonts.black, letterSpacing: -1.5 },
});
