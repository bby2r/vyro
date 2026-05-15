import React, { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '../theme/useTheme';

type Props = TextInputProps & {
  invalid?: boolean;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { invalid, style, ...rest }: Props,
  ref,
) {
  const theme = useTheme();

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={theme.textMuted}
      {...rest}
      style={[
        styles.input,
        {
          backgroundColor: theme.bgAlt,
          color: theme.text,
          borderColor: invalid ? theme.danger : theme.border,
        },
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
  },
});
