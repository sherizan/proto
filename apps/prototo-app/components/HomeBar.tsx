import { GlassView } from 'expo-glass-effect';
import { useRouter, usePathname } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useAccent, useTheme, Text } from 'proto-components';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

function PressScale({ onPress, children, style }: { onPress: () => void; children: React.ReactNode; style?: object }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPressIn={() => (scale.value = withTiming(0.96, TIMING))}
      onPressOut={() => (scale.value = withTiming(1, TIMING))}
      onPress={onPress}
    >
      <Animated.View style={[animated, style]}>{children}</Animated.View>
    </Pressable>
  );
}

// Thumb-zone chrome: tabs pill left, scan FAB alone on the right. Chrome is
// glass; the FAB is the one accent-filled element on the screen.
export function HomeBar() {
  const router = useRouter();
  const pathname = usePathname();
  const accent = useAccent();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const onProfile = pathname.includes('profile');

  const pulse = useSharedValue(1);
  useEffect(() => {
    // one gentle attention beat per cold start, then never again
    const t = { duration: 450, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };
    pulse.value = withSequence(withDelay(900, withTiming(1.08, t)), withTiming(1, t));
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const tab = (label: string, active: boolean, onPress: () => void) => (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text size="label" color={active ? 'accent' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]}>
      <GlassView style={[styles.pill, { backgroundColor: theme.surface.card }]}>
        <View style={styles.pillInner}>
          {tab('Prototypes', !onProfile, () => router.replace('/home'))}
          {tab('Account', onProfile, () => router.replace('/home/profile'))}
        </View>
      </GlassView>
      <Animated.View style={pulseStyle}>
        <PressScale onPress={() => router.push('/connect')}>
          <GlassView style={[styles.fab, { backgroundColor: accent }]}>
            <SymbolView name="qrcode.viewfinder" size={24} tintColor="#FFFFFF" />
          </GlassView>
        </PressScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: { borderRadius: 24, overflow: 'hidden' },
  pillInner: { flexDirection: 'row', gap: 20, paddingVertical: 14, paddingHorizontal: 20 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
