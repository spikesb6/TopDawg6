import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { Icon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { modes } from '@/data/modes';
import { useTheme } from '@/hooks/use-theme';
import { pickRandom, surprisePool } from '@/lib/picker';
import { resultHref } from '@/lib/routes';
import { useDinnerStore } from '@/store/dinner-store';
import { useGrocery } from '@/store/grocery-store';
import { borderWidth, fonts, modeColors, palette, radius, spacing } from '@/theme/theme';

// Tiles lean 1 to 1.5 degrees, alternating direction.
const tileTilts = [-1, 1.5, 1, -1.5];

export default function HomeScreen() {
  const theme = useTheme();
  const { picks, ideas } = useDinnerStore();
  const grocery = useGrocery();
  const toBuy = grocery.items.filter((i) => !i.checked).length;

  const surprise = () => {
    const idea = pickRandom(surprisePool(ideas, picks));
    if (idea) router.push(resultHref(idea.id, { from: 'surprise' }, true));
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Text style={[styles.eyebrow, { color: theme.muted }]}>TONIGHT</Text>
        {toBuy > 0 ? (
          // Only shows once something is on the grocery list.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Grocery list, ${toBuy} left to buy`}
            hitSlop={8}
            onPress={() => router.push('/grocery')}
            style={({ pressed }) => [
              styles.groceryPill,
              { borderColor: theme.text },
              pressed && { opacity: 0.6 },
            ]}>
            <Icon name="list" color={theme.text} size={16} strokeWidth={2.5} />
            <Text style={[styles.groceryText, { color: theme.text }]}>{toBuy} to buy</Text>
          </Pressable>
        ) : null}
      </View>
      <Wordmark style={styles.wordmark} />
      <Text style={[styles.tagline, { color: theme.text }]}>Dinner, decided. No stress.</Text>

      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel="Surprise me"
        accessibilityHint="Picks one dinner idea from every mode"
        tilt={-1.5}
        onPress={surprise}
        style={[styles.surprise, { borderColor: theme.border }]}>
        <Icon name="dice" color={palette.ink} size={26} />
        <Text style={styles.surpriseLabel}>Surprise me</Text>
      </BouncyPressable>

      <Text style={[styles.section, { color: theme.text }]}>Or pick a vibe</Text>

      <View style={styles.grid}>
        {modes.map((mode, i) => (
          <BouncyPressable
            key={mode.key}
            accessibilityRole="button"
            accessibilityLabel={`${mode.title}. ${mode.blurb}`}
            tilt={tileTilts[i]}
            onPress={() => router.push({ pathname: '/mode/[mode]', params: { mode: mode.key } })}
            style={[styles.tile, { backgroundColor: modeColors[mode.key] }]}>
            <Icon name={mode.icon} color={palette.ink} size={26} />
            <Text style={styles.tileTitle}>{mode.title}</Text>
            <Text style={styles.tileBlurb}>{mode.blurb}</Text>
          </BouncyPressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groceryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    // Overlaps the row's padding so showing it doesn't push Home down.
    marginVertical: -8,
    borderWidth: 2,
    borderRadius: 999,
  },
  groceryText: {
    fontFamily: fonts.headingSemi,
    fontSize: 13,
  },
  eyebrow: {
    fontFamily: fonts.headingSemi,
    fontSize: 11,
    letterSpacing: 2.4,
  },
  wordmark: {
    marginTop: 14,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 15,
    marginTop: 16,
  },
  surprise: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    minHeight: 72,
    borderWidth,
    borderRadius: radius.button,
    backgroundColor: palette.sunny,
  },
  surpriseLabel: {
    fontFamily: fonts.heading,
    fontSize: 21,
    color: palette.ink,
  },
  section: {
    fontFamily: fonts.headingSemi,
    fontSize: 15,
    marginTop: 24,
  },
  grid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.gap,
  },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: 104,
    padding: 14,
    borderRadius: radius.tile,
  },
  tileTitle: {
    fontFamily: fonts.headingSemi,
    fontSize: 16,
    color: palette.ink,
    marginTop: 6,
  },
  tileBlurb: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.ink,
    marginTop: 4,
  },
});
