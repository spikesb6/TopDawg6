import { useQuery } from '@tanstack/react-query';

import type { PlacesMode } from '@/lib/places';
import { fetchPlaces } from '@/lib/remote';
import { backendConfigured } from '@/lib/supabase';
import { useLocationStore } from '@/store/location-store';

/** True for the modes that show real nearby places once Supabase is set up. */
export const showsPlaces = (mode: string): mode is PlacesMode =>
  backendConfigured && (mode === 'fast' || mode === 'dine');

/** Open-now places for this mode near the person (or in their city). */
export function usePlaces(mode: PlacesMode) {
  const location = useLocationStore();
  const where = location.status === 'ready' ? location.where : null;
  const query = useQuery({
    queryKey: ['places', mode, where],
    queryFn: () => fetchPlaces(mode, where!),
    enabled: backendConfigured && where != null,
    staleTime: 5 * 60 * 1000,
  });
  return { location, query };
}
