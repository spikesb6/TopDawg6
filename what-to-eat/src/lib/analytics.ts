import PostHog from 'posthog-react-native';

import type { ModeKey } from '@/theme/theme';

// PostHog project keys are public by design (like the Supabase anon key). Without one,
// every call here does nothing.
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const analyticsEnabled = Boolean(key);

const posthog = key ? new PostHog(key, { host, captureAppLifecycleEvents: true }) : null;

/**
 * Everything we measure. Only modes, ids and choices: never names, emails, places or location.
 */
export type AnalyticsEvent =
  | { name: 'surprise_me' }
  | { name: 'mode_opened'; mode: ModeKey }
  | { name: 'pick_one'; mode: ModeKey }
  | { name: 'spin_again'; mode: ModeKey }
  | { name: 'locked_in'; mode: ModeKey; kind: 'idea' | 'place' }
  | { name: 'fave_toggled'; mode: ModeKey; kind: 'idea' | 'place'; on: boolean }
  | { name: 'recipe_opened'; idea_id: number }
  | { name: 'grocery_added'; idea_id: number }
  | { name: 'grocery_shared' }
  | { name: 'delivery_opened'; app: 'doordash' | 'ubereats' | 'grubhub' }
  | { name: 'directions_opened'; mode: ModeKey }
  | { name: 'location_choice'; choice: 'granted' | 'denied' | 'city' }
  | { name: 'sign_in'; provider: 'apple' | 'google'; ok: boolean }
  | { name: 'account_deleted' };

/** Splits an event into PostHog's name and properties. */
export function toCapture(
  event: AnalyticsEvent
): [string, Record<string, string | number | boolean>] {
  const { name, ...props } = event;
  return [name, props];
}

export function track(event: AnalyticsEvent) {
  if (!posthog) return;
  const [name, props] = toCapture(event);
  posthog.capture(name, props);
}

export function trackScreen(path: string) {
  posthog?.screen(path);
}

/** Ties events to the account id (a random uuid), never to an email. */
export function identify(userId: string | null) {
  if (!posthog) return;
  if (userId) posthog.identify(userId);
  else posthog.reset();
}
