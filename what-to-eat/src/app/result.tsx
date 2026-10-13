import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { DeliveryButtons } from '@/components/delivery-buttons';
import { moodLabel } from '@/components/idea-row';
import {
  ActionButton,
  CardDetails,
  CardText,
  CardTitle,
  MetaPills,
  ResultActions,
  ResultCard,
  SpinningName,
} from '@/components/result-parts';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import type { Cost, Mood } from '@/data/ideas';
import { useSpin } from '@/hooks/use-spin';
import { track } from '@/lib/analytics';
import { costLabel, filterIdeas, pickRandom, surprisePool } from '@/lib/picker';
import type { ResultSource } from '@/lib/routes';
import { useDinnerStore } from '@/store/dinner-store';
import { palette, type ModeKey } from '@/theme/theme';

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
  const params = useLocalSearchParams<Params>();
  const store = useDinnerStore();
  const { ideas, ideasById } = store;
  const spin = useSpin(Number(params.id), params.spin === '1', ideas);
  const [lockedId, setLockedId] = useState<number | null>(null);
  const [onlyOne, setOnlyOne] = useState(false);

  const idea = ideasById.get(spin.currentId);
  if (!idea) return <Redirect href="/" />;

  // Mid-spin the card takes the color and mode of whichever name is flashing.
  const shown = spin.spinning ? (spin.flash ?? idea) : idea;
  const source = sourceFrom(params, idea.mode);

  const spinAgain = () => {
    const pool =
      source.from === 'surprise' ? surprisePool(ideas, store.picks) : filterIdeas(ideas, source);
    const next = pickRandom(pool, idea.id);
    setOnlyOne(next == null);
    if (next) {
      track({ name: 'spin_again', mode: idea.mode });
      spin.spinTo(next.id);
    }
  };

  return (
    <Screen>
      <ScreenHeader />

      <ResultCard
        modeKey={shown.mode}
        cardStyle={spin.cardStyle}
        fave={store.isFave(idea.id)}
        onToggleFave={() => store.toggleFave(idea.id)}
        spinning={spin.spinning}>
        {spin.spinning ? (
          <SpinningName name={spin.flash?.name} />
        ) : (
          <>
            <CardTitle>{idea.name}</CardTitle>
            <CardText>{idea.blurb}</CardText>
            <MetaPills items={[`${idea.minutes} min`, costLabel(idea.cost), moodLabel(idea)]} />
            <CardDetails>{idea.details}</CardDetails>
          </>
        )}
      </ResultCard>

      <ResultActions
        locked={lockedId === idea.id}
        spinning={spin.spinning}
        onlyOne={onlyOne}
        onSpin={spinAgain}
        onLockIn={() => {
          store.lockIn(idea.id);
          track({ name: 'locked_in', mode: idea.mode, kind: 'idea' });
          setLockedId(idea.id);
        }}>
        {!spin.spinning && idea.mode === 'cook' && idea.ingredients?.length ? (
          <ActionButton
            label="See the recipe"
            color={palette.coral}
            disabled={spin.spinning}
            onPress={() => {
              track({ name: 'recipe_opened', idea_id: idea.id });
              router.push({ pathname: '/recipe', params: { id: String(idea.id) } });
            }}
          />
        ) : null}
        {!spin.spinning && idea.mode === 'deliv' ? (
          <DeliveryButtons dish={idea.name} disabled={spin.spinning} />
        ) : null}
      </ResultActions>
    </Screen>
  );
}
