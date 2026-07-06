import { View, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';

export type StackProps = {
  gap?: number;
  padding?: number;
  // same values as Row — the asymmetry was a guessable-wrong API paper cut
  align?: 'start' | 'center' | 'end';
  children?: ReactNode;
  style?: ViewProps['style'];
};

const alignMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
} as const;

// No default: an unset align keeps RN's column default (stretch — children fill
// the width), so existing prototypes don't reflow.
export function Stack({ gap = 0, padding = 0, align, style, children }: StackProps) {
  return (
    <View
      style={[
        { flexDirection: 'column', gap, padding },
        align ? { alignItems: alignMap[align] } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
