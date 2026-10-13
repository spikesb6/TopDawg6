import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { IdeaRow } from '@/components/idea-row';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { ideasById } from '@/data/ideas';
import { useTheme } from '@/hooks/use-theme';
import { relativeDay } from '@/lib/picker';
import { resultHref } from '@/lib/routes';
import { useDinnerStore } from '@/store/dinner-store';
import { fonts } from '@/theme/theme';

export default function PastPicksScreen() {
  const theme = useTheme();
  const { picks } = useDinnerStore();
  const rows = picks.flatMap((pick) => {
    const idea = ideasById.get(pick.ideaId);
    return idea ? [{ pick, idea }] : [];
  });

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
          {rows.map(({ pick, idea }) => (
            <IdeaRow
              key={pick.id}
              idea={idea}
              note={relativeDay(pick.pickedAt)}
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
