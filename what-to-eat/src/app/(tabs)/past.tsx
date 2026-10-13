import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { IdeaRow } from '@/components/idea-row';
import { PlaceRow } from '@/components/place-row';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { modesByKey } from '@/data/modes';
import { useTheme } from '@/hooks/use-theme';
import { relativeDay } from '@/lib/picker';
import { placeHref, resultHref } from '@/lib/routes';
import { useDinnerStore } from '@/store/dinner-store';
import { fonts } from '@/theme/theme';

export default function PastPicksScreen() {
  const theme = useTheme();
  const { picks, ideasById } = useDinnerStore();
  // Only picks we can still show: real places, and ideas that still exist.
  const rows = picks.filter((p) => p.place || (p.ideaId != null && ideasById.has(p.ideaId)));

  return (
    <Screen>
      <Wordmark scale={0.5} />
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        Past picks
      </Text>
      {rows.length === 0 ? (
        <EmptyState
          icon="clock"
          title="No picks yet"
          body="Tap Let's eat this on an idea and it shows up here."
        />
      ) : (
        <View style={styles.list}>
          {rows.map((pick) => {
            const when = relativeDay(pick.pickedAt);
            if (pick.place) {
              const place = pick.place;
              return (
                <PlaceRow
                  key={pick.id}
                  name={place.name}
                  mode={place.mode}
                  lines={[modesByKey[place.mode].title]}
                  note={when}
                  onPress={() => router.push(placeHref(place, place.mode))}
                />
              );
            }
            const idea = ideasById.get(pick.ideaId!)!;
            return (
              <IdeaRow
                key={pick.id}
                idea={idea}
                note={when}
                onPress={() => router.push(resultHref(idea.id, { from: 'list', mode: idea.mode }))}
              />
            );
          })}
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
