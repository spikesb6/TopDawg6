import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { Icon } from '@/components/icons';
import { moodLabel } from '@/components/idea-row';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useTheme } from '@/hooks/use-theme';
import { hasRecipe } from '@/lib/grocery';
import { costLabel } from '@/lib/picker';
import { useDinnerStore } from '@/store/dinner-store';
import { useGrocery } from '@/store/grocery-store';
import { borderWidth, fonts, modeColors, palette, radius } from '@/theme/theme';

/** Cook it: ingredients, steps, and Add to grocery list. */
export default function RecipeScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ideasById } = useDinnerStore();
  const grocery = useGrocery();
  const idea = ideasById.get(Number(id));
  if (!idea?.ingredients?.length) return <Redirect href="/" />;

  const onList = hasRecipe(grocery.items, idea.id);
  const meta = [`${idea.minutes} min`, costLabel(idea.cost), moodLabel(idea)];

  return (
    <Screen>
      <ScreenHeader />

      <View style={styles.titleRow}>
        <View style={[styles.badge, { backgroundColor: modeColors.cook }]}>
          <Icon name="chefHat" color={palette.ink} size={30} />
        </View>
        <View style={styles.titleText}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {idea.name}
          </Text>
          <Text style={[styles.blurb, { color: theme.muted }]}>{idea.blurb}</Text>
        </View>
      </View>

      <View style={styles.pills}>
        {meta.map((m) => (
          <View key={m} style={[styles.pill, { borderColor: theme.text }]}>
            <Text style={[styles.pillText, { color: theme.text }]}>{m}</Text>
          </View>
        ))}
      </View>

      <Text accessibilityRole="header" style={[styles.section, { color: theme.text }]}>
        Ingredients
      </Text>
      <View style={styles.ingredients}>
        {idea.ingredients.map((ing) => (
          <Text key={ing.name} style={[styles.ingredient, { color: theme.text }]}>
            {ing.qty ? <Text style={styles.qty}>{ing.qty} </Text> : null}
            {ing.name}
          </Text>
        ))}
      </View>

      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel={onList ? 'See grocery list' : 'Add to grocery list'}
        tilt={-1}
        onPress={() => {
          if (!onList) grocery.addRecipe(idea);
          router.push('/grocery');
        }}
        style={[styles.button, { borderColor: theme.border }]}>
        <Icon name={onList ? 'check' : 'list'} color={palette.ink} size={22} strokeWidth={2.5} />
        <Text style={styles.buttonLabel}>
          {onList ? 'On your grocery list' : 'Add to grocery list'}
        </Text>
      </BouncyPressable>

      <Text accessibilityRole="header" style={[styles.section, { color: theme.text }]}>
        Steps
      </Text>
      <View style={styles.steps}>
        {idea.steps?.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: theme.text }]}>{step}</Text>
          </View>
        ))}
      </View>
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
    fontSize: 28,
    lineHeight: 32,
  },
  blurb: {
    fontFamily: fonts.body,
    fontSize: 15,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 2,
  },
  pillText: {
    fontFamily: fonts.headingSemi,
    fontSize: 14,
  },
  section: {
    fontFamily: fonts.heading,
    fontSize: 20,
    marginTop: 26,
  },
  ingredients: {
    marginTop: 10,
    gap: 8,
  },
  ingredient: {
    fontFamily: fonts.body,
    fontSize: 16,
  },
  qty: {
    fontFamily: fonts.headingSemi,
  },
  button: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 60,
    borderWidth,
    borderRadius: radius.button,
    backgroundColor: palette.sunny,
  },
  buttonLabel: {
    fontFamily: fonts.heading,
    fontSize: 19,
    color: palette.ink,
  },
  steps: {
    marginTop: 12,
    gap: 14,
  },
  step: {
    flexDirection: 'row',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.coral,
  },
  stepNumberText: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: palette.ink,
  },
  stepText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
  },
});
