import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '../theme/useTheme';

type Props = {
  name: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  color?: string;
  size?: number;
  accessibilityLabel?: string;
};

export function IconButton({ name, onPress, color, size = 20, accessibilityLabel }: Props) {
  const theme = useTheme();
  const tint = color ?? theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.6 : 1 }]}>
      <MaterialIcons name={name} color={tint} size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
