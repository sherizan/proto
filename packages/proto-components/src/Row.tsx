import { View, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';

export type RowProps = {
  gap?: number;
  align?: 'start' | 'center' | 'end';
  children?: ReactNode;
  style?: ViewProps['style'];
};

const alignMap = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
} as const;

export function Row({ gap = 0, align = 'start', style, children }: RowProps) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: alignMap[align], gap },
        style,
      ]}
    >
      {children}
    </View>
  );
}
