import { useEffect } from 'react';
import { Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Dismiss splash immediately on module load so a stuck React tree
// can't keep the splash up forever during diagnosis.
SplashScreen.hideAsync().catch(() => {
  // Best-effort.
});

export default function RootLayout() {
  useEffect(() => {
    // Belt-and-braces: also call from a mounted effect.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0d1117',
      }}>
      <Text style={{ color: '#58a6ff', fontSize: 32, fontWeight: 'bold' }}>HELLO</Text>
      <Text style={{ color: '#8b949e', marginTop: 12 }}>diagnostic build</Text>
    </View>
  );
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
