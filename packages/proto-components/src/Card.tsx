import { Platform, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
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
    return (
      <View
        style={{
          borderRadius: theme.radius.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.border.default,
        }}
      >
        <BlurView
          style={{ padding: pad }}
          blurType={Platform.OS === 'ios' ? 'light' : 'light'}
          blurAmount={theme.blur.card}
          reducedTransparencyFallbackColor={theme.surface.card}
        >
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
