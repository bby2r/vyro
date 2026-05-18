import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

// Cold-start URL `/` resolves to this index instead of an actual tab. Bounce
// the user to /expenses imperatively (not via <Redirect>, which hangs the JS
// thread on this Android + Expo SDK 54 + new arch setup).
export default function TabsIndex() {
  useEffect(() => {
    router.replace('/(tabs)/expenses');
  }, []);

  return <View style={{ flex: 1, backgroundColor: '#0d1117' }} />;
}
