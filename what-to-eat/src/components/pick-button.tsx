import { StyleSheet, Text } from 'react-native';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { Icon } from '@/components/icons';
import { useTheme } from '@/hooks/use-theme';
import { borderWidth, fonts, palette, radius } from '@/theme/theme';

/** The grape "Pick one for me" button on mode lists. */
export function PickButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <BouncyPressable
      accessibilityRole="button"
      accessibilityLabel="Pick one for me"
      accessibilityState={{ disabled }}
      disabled={disabled}
      tilt={1}
      onPress={onPress}
      style={[styles.pick, { borderColor: theme.border, opacity: disabled ? 0.5 : 1 }]}>
      <Icon name="dice" color={palette.cream} size={24} />
      <Text style={styles.label}>Pick one for me</Text>
    </BouncyPressable>
  );
}

const styles = StyleSheet.create({
  pick: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 60,
    borderWidth,
    borderRadius: radius.button,
    backgroundColor: palette.grape,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: 19,
    color: palette.cream,
  },
});
