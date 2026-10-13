import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform } from 'react-native';

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
import { modesByKey } from '@/data/modes';
import { useMiles } from '@/hooks/use-miles';
import { usePlaces } from '@/hooks/use-places';
import { useSpin } from '@/hooks/use-spin';
import { track } from '@/lib/analytics';
import { pickRandom } from '@/lib/picker';
import { directionsUrl, filterPlaces, placeMeta, type PlacesMode } from '@/lib/places';
import { useDinnerStore } from '@/store/dinner-store';
import { palette } from '@/theme/theme';

type Params = {
  id: string;
  name: string;
  mode: string;
  mood?: string;
  cost?: string;
  spin?: string;
};

/** The result card for a real place, from a nearby list, Pick one for me, Faves or Past picks. */
export default function PlaceScreen() {
  const params = useLocalSearchParams<Params>();
  const mode = (params.mode === 'dine' ? 'dine' : 'fast') as PlacesMode;
  const filters = {
    mood: (params.mood as Mood) ?? null,
    cost: params.cost ? (Number(params.cost) as Cost) : null,
  };
  const store = useDinnerStore();
  const miles = useMiles();
  const { query } = usePlaces(mode);
  const places = query.data ?? [];
  const spin = useSpin(params.id, params.spin === '1', places);
  const [lockedId, setLockedId] = useState<string | null>(null);
  const [onlyOne, setOnlyOne] = useState(false);

  // A saved place may not be in today's nearby list; then all we know is its id and name.
  const place =
    places.find((p) => p.id === spin.currentId) ??
    (spin.currentId === params.id && params.name
      ? { id: params.id, name: params.name, lat: null, lng: null, address: null, typeLabel: null }
      : null);
  if (!place) return <Redirect href="/" />;

  const full = places.find((p) => p.id === place.id);
  const ref = { id: place.id, name: place.name, mode };

  const spinAgain = () => {
    const next = pickRandom(filterPlaces(places, filters), place.id);
    setOnlyOne(next == null);
    if (next) {
      track({ name: 'spin_again', mode });
      spin.spinTo(next.id);
    }
  };

  return (
    <Screen>
      <ScreenHeader />

      <ResultCard
        modeKey={mode}
        cardStyle={spin.cardStyle}
        fave={store.isPlaceFave(place.id)}
        onToggleFave={() => store.togglePlaceFave(ref)}
        spinning={spin.spinning}>
        {spin.spinning ? (
          <SpinningName name={spin.flash?.name} />
        ) : (
          <>
            <CardTitle>{place.name}</CardTitle>
            <CardText>{place.typeLabel ?? modesByKey[mode].title}</CardText>
            {full ? <MetaPills items={placeMeta(full, miles)} /> : null}
            {place.address ? <CardDetails>{place.address}</CardDetails> : null}
          </>
        )}
      </ResultCard>

      <ResultActions
        locked={lockedId === place.id}
        spinning={spin.spinning}
        onlyOne={onlyOne}
        onlyOneText={
          places.length === 0
            ? `Open ${modesByKey[mode].title} to see more spots near you.`
            : undefined
        }
        onSpin={spinAgain}
        onLockIn={() => {
          store.lockInPlace(ref);
          track({ name: 'locked_in', mode, kind: 'place' });
          setLockedId(place.id);
        }}>
        <ActionButton
          label="Get directions"
          color={palette.sunny}
          disabled={spin.spinning}
          onPress={() => {
            track({ name: 'directions_opened', mode });
            Linking.openURL(directionsUrl(place, Platform.OS)).catch(() => {});
          }}
        />
      </ResultActions>
    </Screen>
  );
}
