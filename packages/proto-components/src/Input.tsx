import { TextInput, type TextInputProps } from 'react-native';
import { useTheme } from './useTheme';

export type InputProps = TextInputProps;

export function Input({ style, ...props }: InputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.text.tertiary}
      style={[
        {
          backgroundColor: theme.surface.secondary,
          color: theme.text.primary,
          borderColor: theme.border.default,
          borderWidth: 1,
          borderRadius: theme.radius.button,
          paddingHorizontal: theme.space.md,
          height: 52,
          fontSize: 17,
        },
        style,
      ]}
      {...props}
    />
  );
}
