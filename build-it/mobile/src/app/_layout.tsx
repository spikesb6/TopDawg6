import { Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { IBMPlexSans_400Regular, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ErrorScreen } from '@/components/error-screen';
import { useScheme, useTheme } from '@/hooks/use-theme';
import { AccountProvider } from '@/store/account-store';
import { BuildStoreProvider, useBuild } from '@/store/build-store';
import { ToastProvider } from '@/store/toast-store';

SplashScreen.preventAutoHideAsync();

/** Shown when a screen crashes, instead of a blank app. */
export const ErrorBoundary = ErrorScreen;

function Navigator() {
  const theme = useTheme();
  const { loaded } = useBuild();
  const [fontsLoaded, fontError] = useFonts({
    Archivo_800ExtraBold,
    Archivo_900Black,
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_500Medium,
  });
  const ready = (fontsLoaded || fontError != null) && loaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="phase/[id]" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="payment-new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="permits" />
      <Stack.Screen name="team" />
      <Stack.Screen name="built-to-last" />
      <Stack.Screen name="project" />
      <Stack.Screen name="account" />
      <Stack.Screen name="photo" />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useScheme();
  return (
    <BuildStoreProvider>
      <AccountProvider>
        <ToastProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Navigator />
        </ToastProvider>
      </AccountProvider>
    </BuildStoreProvider>
  );
}
