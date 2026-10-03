import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-screens/experimental';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, useAccent } from './useTheme';

export type ScreenProps = {
  scrollable?: boolean;
  gradient?: boolean | string;
  children?: ReactNode;
  footer?: ReactNode;
};

/**
 * Screen wrapper for iOS 26+.
 *
 * Scrollable (default): the ScrollView is the top-level element so the native
 * UINavigationBar can track scrolling and apply automatic content insets.
 * Large-title collapse is currently disabled in navigation configuration as a
 * workaround for the iOS 26 scroll/push/back freeze; this wrapper does not enable it.
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
export function Screen({ scrollable = true, gradient, children, footer }: ScreenProps) {
  const theme = useTheme();
  const accent = useAccent();
  const { fontScale, height } = useWindowDimensions();
  const padding = theme.space.md;
  const washColor = gradient === true ? accent : gradient;
  // A 6-digit hex fades from its own zero-alpha; plain 'transparent' greys out mid-way.
  const washStart = washColor && /^#[0-9a-f]{6}$/i.test(washColor) ? `${washColor}00` : 'transparent';
  const wash = washColor ? (
    <LinearGradient
      pointerEvents="none"
      colors={[washStart, washColor]}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1 }}
    />
  ) : null;

  if (footer != null) {
    // Keep the whole flow reachable when a fixed action would consume the viewport.
    if (scrollable && (fontScale >= 1.8 || height < 500)) {
      return <Screen gradient={gradient}>{children}{footer}</Screen>;
    }
    return <ScreenWithFooter scrollable={scrollable} footer={footer} wash={wash}>{children}</ScreenWithFooter>;
  }

  if (scrollable) {
    // A hex wash paints the ScrollView's own background, fixed to the viewport, so it reaches the
    // bottom edge under the home indicator and in the bounce. A wash inside the content stops at the
    // content box, which iOS insets above the home indicator.
    const hexWash = washColor && /^#[0-9a-f]{6}$/i.test(washColor);
    return (
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: theme.surface.primary,
          experimental_backgroundImage: hexWash ? `linear-gradient(to bottom, ${washColor}00, ${washColor}1A)` : undefined,
        }}
        // ponytail: a named colour wash still rides inside the content box (small gap at the bottom).
        contentContainerStyle={{ padding, gap: padding, flexGrow: washColor && !hexWash ? 1 : undefined }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {hexWash ? null : wash}
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

function ScreenWithFooter({ scrollable, footer, wash, children }: {
  scrollable: boolean;
  footer: ReactNode;
  wash: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const container = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const padding = theme.space.md;
  return (
    <View
      ref={container}
      onLayout={() => container.current?.measureInWindow((_x, y) => setOffset(y))}
      style={{ flex: 1, backgroundColor: theme.surface.primary }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={offset}
      >
        {wash}
        <NativeSafeAreaView style={{ flex: 1 }} edges={{ top: !scrollable, bottom: !keyboardVisible, left: true, right: true }}>
          {scrollable ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding, gap: padding }}
              contentInsetAdjustmentBehavior="automatic"
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >{children}</ScrollView>
          ) : <View style={{ flex: 1, padding, gap: padding }}>{children}</View>}
          <View style={{ padding, gap: theme.space.sm, backgroundColor: theme.surface.primary, borderTopWidth: 1, borderTopColor: theme.border.default }}>
            {footer}
          </View>
        </NativeSafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
