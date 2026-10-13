import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icons';
import { modesByKey } from '@/data/modes';
import { useTheme } from '@/hooks/use-theme';
import type { PlacesMode } from '@/lib/places';
import { fonts, modeColors, palette, radius } from '@/theme/theme';

type PlaceRowProps = {
  name: string;
  mode: PlacesMode;
  /** Small lines under the name, like the cuisine and "0.4 mi · $$ · 4.5 ★". */
  lines: string[];
  note?: string;
  onPress: () => void;
};

export function PlaceRow({ name, mode, lines, note, onPress }: PlaceRowProps) {
  const theme = useTheme();
  const label = [name, ...lines, note].filter(Boolean).join('. ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.hairline },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.badge, { backgroundColor: modeColors[mode] }]}>
        <Icon name={modesByKey[mode].icon} color={palette.ink} size={22} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
        {lines.map((line, i) => (
          <Text key={i} style={[i === 0 ? styles.first : styles.meta, { color: theme.muted }]}>
            {line}
          </Text>
        ))}
      </View>
      {note ? <Text style={[styles.note, { color: theme.text }]}>{note}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: 2,
    borderRadius: radius.tile,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.headingSemi,
    fontSize: 17,
  },
  first: {
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  note: {
    fontFamily: fonts.headingSemi,
    fontSize: 13,
  },
});
