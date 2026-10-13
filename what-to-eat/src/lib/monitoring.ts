import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

// Crash reporting with Sentry. Without a DSN nothing is sent and wrapRoot returns the app as is.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export function wrapRoot(Root: ComponentType<Record<string, unknown>>) {
  return dsn ? Sentry.wrap(Root) : Root;
}

export function reportError(error: unknown) {
  if (dsn) Sentry.captureException(error);
}

/** Tags crash reports with the account id (a random uuid), never an email. */
export function setMonitoringUser(userId: string | null) {
  if (dsn) Sentry.setUser(userId ? { id: userId } : null);
}
