import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { PlacesWhere } from '@/lib/remote';

const CITY_KEY = 'what-to-eat/city';

/**
 * - `unknown`: we haven't asked yet, so show the friendly explanation first.
 * - `locating`: permission granted, finding the phone.
 * - `ready`: we have somewhere to search (`where`).
 * - `needs-city`: location was declined or unavailable, so ask for a city.
 */
export type LocationStatus = 'loading' | 'unknown' | 'locating' | 'ready' | 'needs-city';

type LocationStore = {
  status: LocationStatus;
  where: PlacesWhere | null;
  /** Shows the system prompt (only after our own explanation was tapped). */
  askForLocation: () => Promise<void>;
  setCity: (city: string) => void;
  /** Back to choosing between location and a city. */
  change: () => void;
};

const Ctx = createContext<LocationStore | null>(null);

async function currentPosition() {
  const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
  const pos =
    last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>('loading');
  const [where, setWhere] = useState<PlacesWhere | null>(null);

  const locate = () => {
    setStatus('locating');
    currentPosition()
      .then((coords) => {
        setWhere(coords);
        setStatus('ready');
      })
      .catch(() => setStatus('needs-city'));
  };

  // On launch: a saved city wins; otherwise use location only if it was already allowed.
  useEffect(() => {
    (async () => {
      const city = await AsyncStorage.getItem(CITY_KEY).catch(() => null);
      if (city) {
        setWhere({ city });
        setStatus('ready');
        return;
      }
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (perm?.granted) {
        const coords = await currentPosition().catch(() => null);
        setWhere(coords);
        setStatus(coords ? 'ready' : 'needs-city');
      } else {
        setStatus(perm && !perm.canAskAgain ? 'needs-city' : 'unknown');
      }
    })();
  }, []);

  const store: LocationStore = {
    status,
    where,
    askForLocation: async () => {
      const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (perm?.granted) {
        await AsyncStorage.removeItem(CITY_KEY).catch(() => {});
        locate();
      } else {
        setStatus('needs-city');
      }
    },
    setCity: (city) => {
      const clean = city.trim().replace(/\s+/g, ' ');
      if (!clean) return;
      AsyncStorage.setItem(CITY_KEY, clean).catch(() => {});
      setWhere({ city: clean });
      setStatus('ready');
    },
    change: () => {
      AsyncStorage.removeItem(CITY_KEY).catch(() => {});
      setWhere(null);
      setStatus('unknown');
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useLocationStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error('useLocationStore must be used inside LocationProvider');
  return store;
}
