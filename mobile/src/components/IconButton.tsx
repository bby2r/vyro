import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '../theme/useTheme';

type Props = {
  icon: LucideIcon;
  onPress: () => void;
  color?: string;
  size?: number;
  accessibilityLabel?: string;
};

export function IconButton({ icon: Icon, onPress, color, size = 18, accessibilityLabel }: Props) {
  const theme = useTheme();
  const tint = color ?? theme.textMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon color={tint} size={size} />
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
