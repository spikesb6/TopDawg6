import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { IdeaRow } from '@/components/idea-row';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { ideasById } from '@/data/ideas';
import { useTheme } from '@/hooks/use-theme';
import { resultHref } from '@/lib/routes';
import { useDinnerStore } from '@/store/dinner-store';
import { fonts } from '@/theme/theme';

export default function FavesScreen() {
  const theme = useTheme();
  const { favorites } = useDinnerStore();
  const faveIdeas = favorites.flatMap((f) => ideasById.get(f.ideaId) ?? []);

  return (
    <Screen>
      <Wordmark scale={0.5} />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        Faves
      </Text>
      {faveIdeas.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Start your shortlist"
          body="Tap the heart on any idea to keep it here."
        />
      ) : (
        <View style={styles.list}>
          {faveIdeas.map((idea) => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              onPress={() => router.push(resultHref(idea.id, { from: 'list', mode: idea.mode }))}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.heading,
    fontSize: 30,
    marginTop: 18,
  },
  list: {
    marginTop: 18,
    gap: 12,
  },
});
