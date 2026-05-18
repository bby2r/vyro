import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import FormView from '@/src/screens/todos/FormView';
import ListView from '@/src/screens/todos/ListView';
import { useTheme } from '@/src/theme/useTheme';

const TABS = ['Form', 'List'] as const;
type Tab = (typeof TABS)[number];

export default function TodosScreen() {
  const theme = useTheme();
  const [active, setActive] = useState<Tab>('Form');

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={[
          styles.tabBar,
          { backgroundColor: theme.bgAlt, borderBottomColor: theme.border },
        ]}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setActive(t)}
            style={({ pressed }) => [
              styles.tab,
              {
                borderBottomColor: active === t ? theme.accent : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text
              style={{
                color: active === t ? theme.accent : theme.textMuted,
                fontWeight: '600',
                fontSize: 13,
              }}>
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
      {active === 'Form' && <FormView />}
      {active === 'List' && <ListView />}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
});
