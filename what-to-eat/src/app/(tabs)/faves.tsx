import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AccountCard } from '@/components/account-card';
import { EmptyState } from '@/components/empty-state';
import { IdeaRow } from '@/components/idea-row';
import { PlaceRow } from '@/components/place-row';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import type { Idea } from '@/data/ideas';
import { modesByKey } from '@/data/modes';
import type { PlaceRef } from '@/lib/places';
import { useTheme } from '@/hooks/use-theme';
import { placeHref, resultHref } from '@/lib/routes';
import { useDinnerStore } from '@/store/dinner-store';
import { fonts } from '@/theme/theme';

export default function FavesScreen() {
  const theme = useTheme();
  const { favorites, placeFaves, ideasById } = useDinnerStore();
  // Hearted ideas and hearted places together, newest first.
  const rows: ({ idea: Idea; at: number } | { place: PlaceRef; at: number })[] = [
    ...favorites.flatMap((f) => {
      const idea = ideasById.get(f.ideaId);
      return idea ? [{ idea, at: f.createdAt }] : [];
    }),
    ...placeFaves.map((f) => ({ place: f.place, at: f.createdAt })),
  ].sort((a, b) => b.at - a.at);

  return (
    <Screen>
      <Wordmark scale={0.5} />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        Faves
      </Text>
      <AccountCard />
      {rows.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Start your shortlist"
          body="Tap the heart on any idea to keep it here."
        />
      ) : (
        <View style={styles.list}>
          {rows.map((row) =>
            'place' in row ? (
              <PlaceRow
                key={`place-${row.place.id}`}
                name={row.place.name}
                mode={row.place.mode}
                lines={[modesByKey[row.place.mode].title]}
                onPress={() => router.push(placeHref(row.place, row.place.mode))}
              />
            ) : (
              <IdeaRow
                key={row.idea.id}
                idea={row.idea}
                onPress={() =>
                  router.push(resultHref(row.idea.id, { from: 'list', mode: row.idea.mode }))
                }
              />
            )
          )}
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
