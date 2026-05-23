import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';

export type ScreenProps = {
  scrollable?: boolean;
  children?: ReactNode;
};

/**
 * Screen wrapper.
 *
 * Scrollable: the ScrollView is the top-level element so the native
 * UINavigationBar can track it for large-title scroll behavior (the title
 * shrinks to a compact inline title as content scrolls up). Background lives
 * on the ScrollView so it covers bounce areas. `contentInsetAdjustmentBehavior:
 * 'automatic'` lets iOS pad the content for the transparent nav bar + home
 * indicator automatically.
 *
 * Non-scrollable: wrap in View+SafeAreaView so bottom safe area is respected.
 */
export function Screen({ scrollable = true, children }: ScreenProps) {
  const theme = useTheme();

  if (scrollable) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.surface.primary }}
        contentContainerStyle={{ padding: theme.space.md, gap: theme.space.md }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.primary }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
        <View style={{ flex: 1, padding: theme.space.md, gap: theme.space.md }}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}
