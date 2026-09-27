import { View, type ViewProps } from 'react-native';
import { createContext, type ReactNode } from 'react';

// Lets controls know they sit in a row, so they hug their content instead of filling the width.
export const RowContext = createContext(false);

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
      <RowContext.Provider value>{children}</RowContext.Provider>
    </View>
  );
}
