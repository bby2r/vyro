import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { runMigrations } from '@/src/db';
import { logWarn } from '@/src/log';
import { configureNotificationHandler, requestPermissions } from '@/src/notifications';
import { useSyncStore } from '@/src/stores/syncStore';
import { useTenantStore } from '@/src/stores/tenantStore';
import { useThemeStore } from '@/src/stores/themeStore';
import { registerSyncTriggers } from '@/src/sync/triggers';
import { useTheme } from '@/src/theme/useTheme';

// Configure notification foreground handler before any UI mounts.
configureNotificationHandler();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden in some test environments.
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const bootstrapTenant = useTenantStore((s) => s.bootstrap);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateSync = useSyncStore((s) => s.hydrate);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await runMigrations();
        await Promise.all([hydrateTheme(), bootstrapTenant(), hydrateSync()]);
      } catch (err) {
        logWarn('Startup error', err);
      }
      if (!cancelled) {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapTenant, hydrateTheme, hydrateSync]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    SplashScreen.hideAsync().catch(() => {
      // Best-effort.
    });

    // Wire sync triggers + notification permissions once the app is hydrated.
    void requestPermissions();
    const unregister = registerSyncTriggers();
    return () => {
      unregister();
    };
  }, [ready]);

  if (!ready) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const theme = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
      </Stack>
    </GestureHandlerRootView>
  );
}
