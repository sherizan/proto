import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
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

const sizeMap: Record<TextSize, { fontSize: number; fontWeight: TextStyle['fontWeight'] }> = {
  title: { fontSize: 34, fontWeight: '700' },
  headline: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
};

export function Text({ size = 'body', color = 'primary', style, children }: TextProps) {
  const theme = useTheme();
  const accent = useAccent();
  const palette: Record<TextColor, string> = {
    primary: theme.text.primary,
    secondary: theme.text.secondary,
    accent,
    destructive: theme.text.destructive,
  };
  return (
    <RNText style={[sizeMap[size], { color: palette[color] }, style]}>
      {children}
    </RNText>
  );
}
