import React from 'react';
import { Tabs } from 'expo-router';

import { useTheme } from '@/src/theme/useTheme';

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bgAlt },
        headerTintColor: theme.text,
        tabBarStyle: {
          backgroundColor: theme.bgAlt,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
      }}>
      <Tabs.Screen name="expenses" options={{ title: 'Expenses' }} />
      <Tabs.Screen name="todos" options={{ title: 'Todos' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
