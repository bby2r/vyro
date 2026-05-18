import React from 'react';
import { Tabs } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'expenses',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#161b22' },
        headerTintColor: '#c9d1d9',
        tabBarStyle: { backgroundColor: '#161b22' },
        tabBarActiveTintColor: '#58a6ff',
        tabBarInactiveTintColor: '#8b949e',
      }}>
      <Tabs.Screen name="expenses" options={{ title: 'Expenses' }} />
      <Tabs.Screen name="todos" options={{ title: 'Todos' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
