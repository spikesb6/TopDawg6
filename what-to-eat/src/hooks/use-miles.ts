import { usesMiles } from '@/lib/places';

/** Miles for the US and UK, kilometers elsewhere, from the phone's region. */
export function useMiles() {
  let locale = 'en-US';
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {}
  return usesMiles(locale);
}
