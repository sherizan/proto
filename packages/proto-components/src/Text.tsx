import { Text as RNText, useWindowDimensions, type TextProps as RNTextProps } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme, useAccent } from './useTheme';

export type TextSize = 'title' | 'headline' | 'body' | 'caption' | 'label';
export type TextColor = 'primary' | 'secondary' | 'accent' | 'destructive';

export type TextProps = {
  size?: TextSize;
  color?: TextColor;
  children?: ReactNode;
  style?: RNTextProps['style'];
};

export function Text({ size = 'body', color = 'primary', style, children }: TextProps) {
  const theme = useTheme();
  const accent = useAccent();
  // Re-measure native text after a live Dynamic Type change; otherwise Fabric can retain its old height.
  const { fontScale } = useWindowDimensions();
  const palette: Record<TextColor, string> = {
    primary: theme.text.primary,
    secondary: theme.text.secondary,
    accent,
    destructive: theme.text.destructive,
  };
  return (
    <RNText key={fontScale} style={[theme.typography[size], { color: palette[color] }, style]}>
      {children}
    </RNText>
  );
}
