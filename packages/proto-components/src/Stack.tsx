import { View, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';

export type StackProps = {
  gap?: number;
  padding?: number;
  children?: ReactNode;
  style?: ViewProps['style'];
};

export function Stack({ gap = 0, padding = 0, style, children }: StackProps) {
  return (
    <View style={[{ flexDirection: 'column', gap, padding }, style]}>
      {children}
    </View>
  );
}
