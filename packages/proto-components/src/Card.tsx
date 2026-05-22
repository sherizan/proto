import { View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';

export type CardProps = {
  glass?: boolean;
  padding?: number;
  children?: ReactNode;
};

export function Card({ glass = false, padding, children }: CardProps) {
  const theme = useTheme();
  const pad = padding ?? theme.space.md;

  if (glass) {
    if (isLiquidGlassAvailable()) {
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
          borderRadius: theme.radius.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.border.default,
          backgroundColor: theme.surface.card,
        }}
      >
        <BlurView intensity={theme.blur.card} tint="light" style={{ padding: pad }}>
          {children}
        </BlurView>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: theme.surface.card,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        borderColor: theme.border.default,
        padding: pad,
      }}
    >
      {children}
    </View>
  );
}
