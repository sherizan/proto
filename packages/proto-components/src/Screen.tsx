import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, useAccent } from './useTheme';

export type ScreenProps = {
  scrollable?: boolean;
  gradient?: boolean | string;
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
 *
 * gradient: a light wash of the accent (or the given colour) rising from the bottom edge and
 * fading out towards the top. Sits behind the content.
 */
export function Screen({ scrollable = true, gradient, children }: ScreenProps) {
  const theme = useTheme();
  const accent = useAccent();
  const padding = theme.space.md;
  const washColor = gradient === true ? accent : gradient;
  // A 6-digit hex fades from its own zero-alpha; plain 'transparent' greys out mid-way.
  const washStart = washColor && /^#[0-9a-f]{6}$/i.test(washColor) ? `${washColor}00` : 'transparent';
  const wash = washColor ? (
    <LinearGradient
      pointerEvents="none"
      colors={[washStart, washColor]}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.18 }}
    />
  ) : null;

  if (scrollable) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.surface.primary }}
        contentContainerStyle={{ padding, gap: padding }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {wash}
        {children}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.surface.primary }}
      edges={['top', 'bottom', 'left', 'right']}
    >
      {wash}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, padding, gap: padding }}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
