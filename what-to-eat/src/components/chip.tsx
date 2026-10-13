import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { fonts, palette } from '@/theme/theme';

type ChipProps = {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  selectedColor: string;
  onPress: () => void;
};

export function Chip({ label, accessibilityLabel, selected, selectedColor, onPress }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: selectedColor, borderColor: palette.ink }
          : { borderColor: theme.hairline },
        pressed && { opacity: 0.7 },
      ]}>
      <Text style={[styles.label, { color: selected ? palette.ink : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
  },
  label: {
    fontFamily: fonts.headingSemi,
    fontSize: 15,
  },
});
