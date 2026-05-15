import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/useTheme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bordered?: boolean;
};

export function Row({ children, style, bordered }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.row,
        bordered && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
});
