import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Dismiss splash immediately so React UI is always visible.
SplashScreen.hideAsync().catch(() => {});

export default function RootLayout() {
  return <Slot />;
}
