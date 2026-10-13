import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { Icon } from '@/components/icons';
import { moodLabel } from '@/components/idea-row';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import type { Cost, Idea, Mood } from '@/data/ideas';
import { modesByKey } from '@/data/modes';
import { useTheme } from '@/hooks/use-theme';
import { costLabel, filterIdeas, pickRandom, surprisePool } from '@/lib/picker';
import type { ResultSource } from '@/lib/routes';
import { useDinnerStore } from '@/store/dinner-store';
import { borderWidth, fonts, modeColors, palette, radius, type ModeKey } from '@/theme/theme';

const SPIN_MS = 1300;
const FLASH_MS = 100;
const WOBBLE_MS = 80;

type Params = {
  id: string;
  from?: string;
  mode?: string;
  mood?: string;
  cost?: string;
  spin?: string;
};

function sourceFrom(params: Params, fallbackMode: ModeKey): ResultSource {
  if (params.from === 'surprise') return { from: 'surprise' };
  return {
    from: 'list',
    mode: (params.mode as ModeKey) ?? fallbackMode,
    mood: (params.mood as Mood) ?? null,
    cost: params.cost ? (Number(params.cost) as Cost) : null,
  };
}

export default function ResultScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<Params>();
  const store = useDinnerStore();
  const { ideas, ideasById } = store;
  const reduceMotion = useReducedMotion();

  const startId = Number(params.id);
  const [ideaId, setIdeaId] = useState(startId);
  // While spinTarget is set the card wobbles and flashes names, then lands on it.
  const [spinTarget, setSpinTarget] = useState<number | null>(() =>
    params.spin === '1' && !reduceMotion ? startId : null
  );
  const [flashIdea, setFlashIdea] = useState<Idea | null>(null);
  const [lockedId, setLockedId] = useState<number | null>(null);
  const [onlyOne, setOnlyOne] = useState(false);

  const wobble = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-1 + wobble.get()}deg` }],
  }));

  useEffect(() => {
    if (spinTarget == null) return;
    wobble.set(
      withSequence(
        withRepeat(
          withSequence(
            withTiming(-4, { duration: WOBBLE_MS }),
            withTiming(4, { duration: WOBBLE_MS })
          ),
          Math.floor(SPIN_MS / (WOBBLE_MS * 2)),
          true
        ),
        withTiming(0, { duration: WOBBLE_MS })
      )
    );
    const flash = setInterval(() => {
      setFlashIdea(ideas[Math.floor(Math.random() * ideas.length)]);
    }, FLASH_MS);
    const land = setTimeout(() => {
      clearInterval(flash);
      setIdeaId(spinTarget);
      setFlashIdea(null);
      setSpinTarget(null);
    }, SPIN_MS);
    return () => {
      clearInterval(flash);
      clearTimeout(land);
    };
  }, [spinTarget, wobble, ideas]);

  const idea = ideasById.get(ideaId);
  if (!idea) return <Redirect href="/" />;

  const spinning = spinTarget != null;
  // Mid-spin the card takes the color and mode of whichever name is flashing.
  const shown = spinning ? (flashIdea ?? idea) : idea;
  const mode = modesByKey[shown.mode];
  const source = sourceFrom(params, idea.mode);
  const fave = store.isFave(idea.id);
  const locked = lockedId === idea.id;

  const spinAgain = () => {
    const pool =
      source.from === 'surprise' ? surprisePool(ideas, store.picks) : filterIdeas(ideas, source);
    const next = pickRandom(pool, idea.id);
    setOnlyOne(next == null);
    if (!next) return;
    if (reduceMotion) setIdeaId(next.id);
    else setSpinTarget(next.id);
  };

  const lockIn = () => {
    store.lockIn(idea.id);
    setLockedId(idea.id);
  };

  const meta = [`${idea.minutes} min`, costLabel(idea.cost), moodLabel(idea)];

  return (
    <Screen>
      <ScreenHeader />

      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.card,
          { backgroundColor: modeColors[shown.mode], borderColor: palette.ink },
          cardStyle,
        ]}>
        <View style={styles.cardTop}>
          <View style={styles.modeTag}>
            <Icon name={mode.icon} color={palette.ink} size={18} />
            <Text style={styles.modeTagText}>{mode.title}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fave ? 'Remove from faves' : 'Add to faves'}
            accessibilityState={{ selected: fave, disabled: spinning }}
            disabled={spinning}
            hitSlop={10}
            onPress={() => store.toggleFave(idea.id)}
            style={({ pressed }) => [styles.heart, pressed && { opacity: 0.6 }]}>
            <Icon name="heart" color={fave ? palette.tomato : palette.ink} filled={fave} />
          </Pressable>
        </View>

        {spinning ? (
          <Text accessibilityLabel="Spinning" style={styles.name}>
            {flashIdea?.name ?? '…'}
          </Text>
        ) : (
          <>
            <Text accessibilityRole="header" style={styles.name}>
              {idea.name}
            </Text>
            <Text style={styles.blurb}>{idea.blurb}</Text>
            <View style={styles.metaRow}>
              {meta.map((m) => (
                <View key={m} style={styles.metaPill}>
                  <Text style={styles.metaText}>{m}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.details}>{idea.details}</Text>
          </>
        )}
      </Animated.View>

      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel={locked ? 'Locked in' : "Let's eat this"}
        accessibilityState={{ disabled: spinning || locked }}
        disabled={spinning || locked}
        tilt={-1}
        onPress={lockIn}
        style={[styles.primary, { borderColor: theme.border, opacity: spinning ? 0.5 : 1 }]}>
        <Text style={styles.primaryLabel}>{locked ? 'Locked in. Enjoy!' : "Let's eat this"}</Text>
      </BouncyPressable>

      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel="Spin again"
        accessibilityState={{ disabled: spinning }}
        disabled={spinning}
        tilt={1}
        onPress={spinAgain}
        style={[styles.secondary, { borderColor: theme.text, opacity: spinning ? 0.5 : 1 }]}>
        <Icon name="dice" color={theme.text} size={22} />
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>Spin again</Text>
      </BouncyPressable>

      {onlyOne ? (
        <Text style={[styles.note, { color: theme.muted }]}>
          That&apos;s the only match. Loosen your filters for more.
        </Text>
      ) : null}

      {locked ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="See past picks"
          onPress={() => router.navigate('/past')}>
          <Text style={[styles.link, { color: theme.text }]}>See past picks</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 26,
    padding: 22,
    borderWidth,
    borderRadius: radius.card,
    minHeight: 280,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  modeTagText: {
    fontFamily: fonts.headingSemi,
    fontSize: 14,
    color: palette.ink,
  },
  heart: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 38,
    color: palette.ink,
    marginTop: 18,
  },
  blurb: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: palette.ink,
  },
  metaText: {
    fontFamily: fonts.headingSemi,
    fontSize: 14,
    color: palette.ink,
  },
  details: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: palette.ink,
    marginTop: 16,
  },
  primary: {
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    borderWidth,
    borderRadius: radius.button,
    backgroundColor: palette.mint,
  },
  primaryLabel: {
    fontFamily: fonts.heading,
    fontSize: 21,
    color: palette.ink,
  },
  secondary: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 58,
    borderWidth,
    borderRadius: radius.button,
  },
  secondaryLabel: {
    fontFamily: fonts.heading,
    fontSize: 19,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 14,
  },
  link: {
    fontFamily: fonts.headingSemi,
    fontSize: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: 18,
  },
});
