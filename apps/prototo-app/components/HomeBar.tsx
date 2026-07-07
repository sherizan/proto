import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useAccent } from 'proto-components';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityRole, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TIMING = { duration: 160, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };

function PressScale({
  onPress,
  children,
  style,
  accessibilityRole,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: ReactNode;
  style?: object;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPressIn={() => (scale.value = withTiming(0.96, TIMING))}
      onPressOut={() => (scale.value = withTiming(1, TIMING))}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// The one accent-filled action on screen: a floating scan button in the thumb
// zone, riding ABOVE the native Liquid Glass tab bar (tabs stay native — the
// system pill is the real thing; we only add what the system can't give us).
export function ScanFab() {
  const router = useRouter();
  const accent = useAccent();
  const insets = useSafeAreaInsets();

  const pulse = useSharedValue(1);
  useEffect(() => {
    // one gentle attention beat per cold start, then never again
    const t = { duration: 450, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };
    pulse.value = withSequence(withDelay(900, withTiming(1.08, t)), withTiming(1, t));
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View
      pointerEvents="box-none"
      // clear the native tab bar: its height plus a breath
      style={[styles.wrap, { bottom: insets.bottom + 60 }]}
    >
      <Animated.View style={pulseStyle}>
        <PressScale
          onPress={() => router.push('/connect')}
          accessibilityRole="button"
          accessibilityLabel="Scan a QR code"
        >
          <View
            style={[
              styles.fab,
              {
                backgroundColor: accent,
                shadowColor: accent,
                shadowOpacity: 0.45,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              },
            ]}
          >
            <SymbolView name="qrcode.viewfinder" size={24} tintColor="#FFFFFF" />
          </View>
        </PressScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
