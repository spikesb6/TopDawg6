import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icons';
import { moods, type Idea } from '@/data/ideas';
import { modesByKey } from '@/data/modes';
import { useTheme } from '@/hooks/use-theme';
import { costLabel } from '@/lib/picker';
import { fonts, modeColors, palette, radius } from '@/theme/theme';

type IdeaRowProps = {
  idea: Idea;
  onPress: () => void;
  /** Small label on the right, like "Yesterday" on Past picks. */
  note?: string;
};

export function moodLabel(idea: Idea) {
  return moods.find((m) => m.key === idea.mood)?.label ?? '';
}

export function IdeaRow({ idea, onPress, note }: IdeaRowProps) {
  const theme = useTheme();
  const mode = modesByKey[idea.mode];
  const meta = `${idea.minutes} min · ${costLabel(idea.cost)} · ${moodLabel(idea)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${idea.name}. ${idea.blurb}. ${meta}${note ? `. ${note}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.hairline },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.badge, { backgroundColor: modeColors[idea.mode] }]}>
        <Icon name={mode.icon} color={palette.ink} size={22} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text }]}>{idea.name}</Text>
        <Text style={[styles.blurb, { color: theme.muted }]}>{idea.blurb}</Text>
        <Text style={[styles.meta, { color: theme.muted }]}>{meta}</Text>
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
  blurb: {
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
