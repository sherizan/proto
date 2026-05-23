import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';

export type ScreenProps = {
  scrollable?: boolean;
  children?: ReactNode;
};

export function Screen({ scrollable = true, children }: ScreenProps) {
  const theme = useTheme();
  const Body = scrollable ? ScrollView : View;
  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.primary }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
        <Body
          style={{ flex: 1 }}
          contentContainerStyle={
            scrollable
              ? { padding: theme.space.md, gap: theme.space.md }
              : undefined
          }
          contentInsetAdjustmentBehavior={scrollable ? 'automatic' : undefined}
        >
          {scrollable ? (
            children
          ) : (
            <View style={{ flex: 1, padding: theme.space.md, gap: theme.space.md }}>
              {children}
            </View>
          )}
        </Body>
      </SafeAreaView>
    </View>
  );
}
