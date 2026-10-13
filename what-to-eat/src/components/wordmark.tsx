import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { fonts } from '@/theme/theme';

type WordmarkProps = {
  /** Multiplies every size; 1 is the Home screen wordmark. */
  scale?: number;
  style?: StyleProp<ViewStyle>;
};

// The wordmark is always crooked: What -7deg, to 6deg and smaller, eat? -3deg, largest and nudged right.
export function Wordmark({ scale = 1, style }: WordmarkProps) {
  const theme = useTheme();
  const size = (n: number) => Math.round(n * scale);

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="What to eat?"
      style={[styles.row, style]}>
      <Text
        style={[
          styles.word,
          {
            color: theme.wordWhat,
            fontSize: size(50),
            lineHeight: size(56),
            transform: [{ rotate: '-7deg' }],
          },
        ]}>
        What
      </Text>
      <Text
        style={[
          styles.word,
          {
            color: theme.wordTo,
            fontSize: size(28),
            lineHeight: size(32),
            marginLeft: size(8),
            marginBottom: size(16),
            transform: [{ rotate: '6deg' }],
          },
        ]}>
        to
      </Text>
      <Text
        style={[
          styles.word,
          {
            color: theme.wordEat,
            fontSize: size(61),
            lineHeight: size(66),
            marginLeft: size(20),
            transform: [{ rotate: '-3deg' }],
          },
        ]}>
        eat?
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  word: {
    fontFamily: fonts.heading,
    includeFontPadding: false,
  },
});
