import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';

export type ScreenProps = {
  scrollable?: boolean;
  children?: ReactNode;
};

/**
 * Screen wrapper for iOS 26+.
 *
 * Scrollable (default): the ScrollView is the top-level element so the native
 * UINavigationBar can track it for large-title scroll behavior — the big
 * title shrinks to a compact inline title as content scrolls up. iOS's
 * automatic content insets handle the transparent nav bar and home indicator.
 *
 * Non-scrollable: SafeAreaView guards bottom + side edges (no scroll to track).
 *
 * Background lives on the outermost element so it covers bounce / inset areas.
 * For Liquid Glass surfaces inside (cards, sheets), use Card with glass={true}
 * — it wraps expo-glass-effect's GlassView, iOS 26's native material.
 */
export function Screen({ scrollable = true, children }: ScreenProps) {
  const theme = useTheme();
  const padding = theme.space.md;

  if (scrollable) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.surface.primary }}
        contentContainerStyle={{ padding, gap: padding }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.surface.primary }}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, padding, gap: padding }}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
