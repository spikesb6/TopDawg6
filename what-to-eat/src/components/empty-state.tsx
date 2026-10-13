import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { Icon, type IconName } from '@/components/icons';
import { useTheme } from '@/hooks/use-theme';
import { borderWidth, fonts, palette, radius } from '@/theme/theme';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  body: string;
};

export function EmptyState({ icon, title, body }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <Icon name={icon} color={theme.muted} size={44} />
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>{body}</Text>
      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel="Go to Home"
        tilt={1}
        style={[styles.button, { borderColor: theme.border }]}
        onPress={() => router.navigate('/')}>
        <Text style={styles.buttonLabel}>Find dinner</Text>
      </BouncyPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    marginTop: 14,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
  button: {
    marginTop: 22,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderWidth,
    borderRadius: radius.button,
    backgroundColor: palette.grape,
  },
  buttonLabel: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: palette.cream,
  },
});
