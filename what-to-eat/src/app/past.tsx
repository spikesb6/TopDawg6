import { StyleSheet, Text } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { useTheme } from '@/hooks/use-theme';
import { fonts } from '@/theme/theme';

// Phase 1 shell: the list arrives in Phase 2.
export default function PastPicksScreen() {
  const theme = useTheme();

  return (
    <Screen>
      <Wordmark scale={0.5} />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        Past picks
      </Text>
      <EmptyState
        icon="clock"
        title="No picks yet"
        body="Tap Let's eat this on an idea and it shows up here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.heading,
    fontSize: 30,
    marginTop: 18,
  },
});
