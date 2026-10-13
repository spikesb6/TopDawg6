import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BouncyPressable } from '@/components/bouncy-pressable';
import { PickButton } from '@/components/pick-button';
import { PlaceRow } from '@/components/place-row';
import type { Cost, Mood } from '@/data/ideas';
import { useMiles } from '@/hooks/use-miles';
import { usePlaces } from '@/hooks/use-places';
import { useTheme } from '@/hooks/use-theme';
import { pickRandom } from '@/lib/picker';
import { filterPlaces, placeMeta, type PlacesMode } from '@/lib/places';
import { placeHref } from '@/lib/routes';
import { useLocationStore } from '@/store/location-store';
import { borderWidth, fonts, palette, radius } from '@/theme/theme';

type Props = { mode: PlacesMode; mood: Mood | null; cost: Cost | null };

/** Fast food and Dine out: real places open now, near the person or in their city. */
export function NearbyPlaces({ mode, mood, cost }: Props) {
  const theme = useTheme();
  const miles = useMiles();
  const { location, query } = usePlaces(mode);

  if (location.status === 'loading' || location.status === 'locating') {
    return <Text style={[styles.status, { color: theme.muted }]}>Finding where you are…</Text>;
  }
  if (location.status === 'unknown') return <LocationAsk />;
  if (location.status === 'needs-city') return <CityForm />;

  const where = location.where;
  const heading = where && 'city' in where ? `Open now in ${where.city}` : 'Open now near you';
  const places = query.data ?? [];
  const matches = filterPlaces(places, { mood, cost });

  return (
    <View>
      <PickButton
        disabled={matches.length === 0}
        onPress={() => {
          const place = pickRandom(matches);
          if (place) router.push(placeHref(place, mode, { mood, cost }, true));
        }}
      />

      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
          {heading}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change location"
          hitSlop={8}
          onPress={location.change}>
          <Text style={[styles.link, { color: theme.text }]}>Change</Text>
        </Pressable>
      </View>

      {query.isPending ? (
        <Text style={[styles.status, { color: theme.muted }]}>
          Finding spots that are open now…
        </Text>
      ) : query.isError ? (
        <Message
          title="Couldn't load places"
          body="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => query.refetch() }}
        />
      ) : places.length === 0 ? (
        <Message
          title="Nothing open right now"
          body={
            where && 'city' in where
              ? 'Try another city, or check back a little later.'
              : 'Nothing nearby is open. Try a city instead.'
          }
          action={{ label: 'Change location', onPress: location.change }}
        />
      ) : matches.length === 0 ? (
        <Message title="Nothing matches" body="Try loosening your filters." />
      ) : (
        <View style={styles.list}>
          {matches.map((place) => (
            <PlaceRow
              key={place.id}
              name={place.name}
              mode={mode}
              lines={[place.typeLabel ?? '', placeMeta(place, miles).join(' · ')].filter(Boolean)}
              onPress={() => router.push(placeHref(place, mode, { mood, cost }))}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function LocationAsk() {
  const theme = useTheme();
  const { askForLocation, setCity } = useLocationStore();
  const [typing, setTyping] = useState(false);
  if (typing) return <CityForm intro="Which city are you in?" onSubmit={setCity} />;

  return (
    <View style={[styles.card, { borderColor: theme.hairline }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.text }]}>
        Find spots open now
      </Text>
      <Text style={[styles.cardBody, { color: theme.muted }]}>
        We use your location to show places near you that are open right now. We don&apos;t save it.
      </Text>
      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel="Use my location"
        tilt={-1}
        onPress={askForLocation}
        style={[styles.button, { borderColor: theme.border, backgroundColor: palette.grape }]}>
        <Text style={[styles.buttonLabel, { color: palette.cream }]}>Use my location</Text>
      </BouncyPressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Type a city instead"
        onPress={() => setTyping(true)}
        style={styles.textButton}>
        <Text style={[styles.link, { color: theme.text }]}>Type a city instead</Text>
      </Pressable>
    </View>
  );
}

function CityForm({ intro, onSubmit }: { intro?: string; onSubmit?: (city: string) => void }) {
  const theme = useTheme();
  const actions = useLocationStore();
  const submit = onSubmit ?? actions.setCity;
  const [city, setCityText] = useState('');
  const ready = city.trim().length > 0;

  return (
    <View style={[styles.card, { borderColor: theme.hairline }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.text }]}>
        {intro ?? 'No problem. Which city?'}
      </Text>
      <Text style={[styles.cardBody, { color: theme.muted }]}>
        We&apos;ll show places there that are open right now.
      </Text>
      <TextInput
        accessibilityLabel="City"
        value={city}
        onChangeText={setCityText}
        onSubmitEditing={() => ready && submit(city)}
        placeholder="City, like Austin, TX"
        placeholderTextColor={theme.muted}
        returnKeyType="search"
        autoCapitalize="words"
        autoCorrect={false}
        style={[styles.input, { color: theme.text, borderColor: theme.text }]}
      />
      <BouncyPressable
        accessibilityRole="button"
        accessibilityLabel="Show spots"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        tilt={1}
        onPress={() => submit(city)}
        style={[
          styles.button,
          { borderColor: theme.border, backgroundColor: palette.sunny, opacity: ready ? 1 : 0.5 },
        ]}>
        <Text style={[styles.buttonLabel, { color: palette.ink }]}>Show spots</Text>
      </BouncyPressable>
    </View>
  );
}

function Message({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();
  return (
    <View style={styles.message}>
      <Text style={[styles.messageTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.messageBody, { color: theme.muted }]}>{body}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={styles.textButton}>
          <Text style={[styles.link, { color: theme.text }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 32,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  heading: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  link: {
    fontFamily: fonts.headingSemi,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
  card: {
    marginTop: 24,
    padding: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.tile,
    gap: 10,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 6,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth,
    borderRadius: radius.button,
  },
  buttonLabel: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: radius.tile,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  message: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  messageTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
  },
  messageBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
  },
});
