import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

import { useTheme } from '@/src/theme/useTheme';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function TodosTopTabs() {
  const theme = useTheme();

  return (
    <MaterialTopTabs
      initialRouteName="form"
      screenOptions={{
        tabBarStyle: { backgroundColor: theme.bgAlt },
        tabBarIndicatorStyle: { backgroundColor: theme.accent },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: { fontWeight: '600', textTransform: 'none', fontSize: 13 },
      }}>
      <MaterialTopTabs.Screen name="form" options={{ title: 'Form' }} />
      <MaterialTopTabs.Screen name="list" options={{ title: 'List' }} />
    </MaterialTopTabs>
  );
}
