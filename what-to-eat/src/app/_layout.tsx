import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Nunito_700Bold } from '@expo-google-fonts/nunito';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ErrorScreen } from '@/components/error-screen';
import { SignInSheet } from '@/components/sign-in-sheet';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { trackScreen } from '@/lib/analytics';
import { wrapRoot } from '@/lib/monitoring';
import { DinnerStoreProvider } from '@/store/dinner-store';
import { GroceryProvider } from '@/store/grocery-store';
import { LocationProvider } from '@/store/location-store';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/** Shown when a screen crashes, instead of a blank app. */
export const ErrorBoundary = ErrorScreen;

function RootLayout() {
  const scheme = useScheme();
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_700Bold,
  });
  const ready = fontsLoaded || fontError != null;
  const pathname = usePathname();

  useEffect(() => {
    trackScreen(pathname);
  }, [pathname]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <DinnerStoreProvider>
        <LocationProvider>
          <GroceryProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.background },
              }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="mode/[mode]" />
              <Stack.Screen name="result" />
              <Stack.Screen name="place" />
              <Stack.Screen name="recipe" />
              <Stack.Screen name="grocery" />
            </Stack>
            <SignInSheet />
          </GroceryProvider>
        </LocationProvider>
      </DinnerStoreProvider>
    </QueryClientProvider>
  );
}

export default wrapRoot(RootLayout);
