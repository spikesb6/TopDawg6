import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icons';
import { IdeaRow } from '@/components/idea-row';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { costs, moods, type Cost, type Mood } from '@/data/ideas';
import { modesByKey } from '@/data/modes';
import { useTheme } from '@/hooks/use-theme';
import { costLabel, filterIdeas, pickRandom } from '@/lib/picker';
import { resultHref, type ResultSource } from '@/lib/routes';
import { useDinnerStore } from '@/store/dinner-store';
import { borderWidth, fonts, modeColors, palette, radius, type ModeKey } from '@/theme/theme';

export default function ModeListScreen() {
  const theme = useTheme();
  const { mode: modeParam } = useLocalSearchParams<{ mode: string }>();
  const { ideas } = useDinnerStore();
  const [mood, setMood] = useState<Mood | null>(null);
  const [cost, setCost] = useState<Cost | null>(null);

  const mode = modesByKey[modeParam as ModeKey];
  if (!mode) return <Redirect href="/" />;

  const color = modeColors[mode.key];
  const source: ResultSource = { from: 'list', mode: mode.key, mood, cost };
  const matches = filterIdeas(ideas, source);

  const pickOne = () => {
    const idea = pickRandom(matches);
    if (idea) router.push(resultHref(idea.id, source, true));
  };

  return (
    <Screen>
      <ScreenHeader />

      <View style={styles.titleRow}>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Icon name={mode.icon} color={palette.ink} size={30} />
        </View>
        <View style={styles.titleText}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {mode.title}
          </Text>
          <Text style={[styles.blurb, { color: theme.muted }]}>{mode.blurb}</Text>
        </View>
      </View>

      <Text style={[styles.label, { color: theme.text }]}>Mood</Text>
      <View style={styles.chips}>
        {moods.map((m) => (
          <Chip
            key={m.key}
            label={m.label}
            accessibilityLabel={`Mood: ${m.label}`}
            selected={mood === m.key}
            selectedColor={color}
            onPress={() => setMood(mood === m.key ? null : m.key)}
          />
        ))}
      </View>

      <Text style={[styles.label, { color: theme.text }]}>Budget</Text>
      <View style={styles.chips}>
        {costs.map((c) => (
          <Chip
            key={c}
            label={costLabel(c)}
            accessibilityLabel={`Budget: ${['low', 'medium', 'high'][c - 1]}`}
            selected={cost === c}
            selectedColor={color}
            onPress={() => setCost(cost === c ? null : c)}
          />
        ))}
      </View>

      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel="Pick one for me"
        accessibilityState={{ disabled: matches.length === 0 }}
        disabled={matches.length === 0}
        tilt={1}
        onPress={pickOne}
        style={[
          styles.pick,
          { borderColor: theme.border, opacity: matches.length === 0 ? 0.5 : 1 },
        ]}>
        <Icon name="dice" color={palette.cream} size={24} />
        <Text style={styles.pickLabel}>Pick one for me</Text>
      </BouncyPressable>

      {matches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nothing matches</Text>
          <Text style={[styles.emptyBody, { color: theme.muted }]}>
            Try loosening your filters.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {matches.map((idea) => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              onPress={() => router.push(resultHref(idea.id, source))}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 22,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  titleText: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 32,
  },
  blurb: {
    fontFamily: fonts.body,
    fontSize: 15,
  },
  label: {
    fontFamily: fonts.headingSemi,
    fontSize: 15,
    marginTop: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
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
  pickLabel: {
    fontFamily: fonts.heading,
    fontSize: 19,
    color: palette.cream,
  },
  list: {
    marginTop: 20,
    gap: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    marginTop: 6,
  },
});
