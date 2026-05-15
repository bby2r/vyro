import { Stack } from 'expo-router';

import { useTheme } from '@/src/theme/useTheme';

export default function SettingsStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bgAlt },
        headerTitleStyle: { color: theme.text },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.bg },
      }}>
      <Stack.Screen name="export" options={{ title: 'Export tenant' }} />
      <Stack.Screen name="import" options={{ title: 'Import tenant' }} />
    </Stack>
  );
}
