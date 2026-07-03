import { View } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';

export type CardProps = {
  glass?: boolean;
  padding?: number;
  children?: ReactNode;
};

/**
 * Card surface.
 *
 * glass={true}: Apple Liquid Glass via expo-glass-effect's GlassView. On
 * iOS 26+ this paints the real native material that refracts content behind
 * it. On older iOS GlassView falls back to a plain View — no third-party
 * blur. Proto targets iOS 26 and only uses Apple's native material.
 *
 * Plain (no glass): opaque surface with theme tokens.
 */
export function Card({ glass = false, padding, children }: CardProps) {
  const theme = useTheme();
  const pad = padding ?? theme.space.md;

  if (glass) {
    return (
      <GlassView
        style={{
          borderRadius: theme.radius.card,
          borderWidth: 1,
          borderColor: theme.border.default,
          padding: pad,
          overflow: 'hidden',
        }}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={{
        backgroundColor: theme.surface.card,
        borderRadius: theme.radius.card,
        padding: pad,
      }}
    >
      {children}
    </View>
  );
}
