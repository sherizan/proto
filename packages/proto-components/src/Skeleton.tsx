import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, View, type DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from './useTheme';

export type SkeletonProps = {
  loading: boolean;
  placeholder: ReactNode;
  children?: ReactNode;
  label?: string;
  /** Set false when the route or region is not visible. */
  active?: boolean;
  /** Can disable shimmer, but cannot override the system's Reduce Motion. */
  shimmer?: boolean;
};

export type SkeletonBlockProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
};

const ShimmerContext = createContext<Animated.Value | null>(null);

/** Initial data loading only: retain existing content during refresh. */
export function Skeleton({ loading, children, ...props }: SkeletonProps) {
  return loading ? <PendingSkeleton {...props} /> : <>{children}</>;
}

function PendingSkeleton({ placeholder, label = 'Loading content', active = true, shimmer = true }: Omit<SkeletonProps, 'loading' | 'children'>) {
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  useEffect(() => {
    // Reserve the final layout immediately, but don't flash on fast responses.
    const timer = setTimeout(() => setVisible(true), 180);
    let live = true;
    let preferenceChanged = false;
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      preferenceChanged = true;
      setReduceMotion(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (live && !preferenceChanged) setReduceMotion(value);
    }).catch(() => {});
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { live = false; clearTimeout(timer); motion.remove(); app.remove(); };
  }, []);

  const animate = visible && active && foreground && shimmer && !reduceMotion;
  useEffect(() => {
    progress.setValue(0);
    if (!animate) return;
    // One native clock per loading region, shared by every placeholder shape.
    const loop = Animated.loop(Animated.timing(progress, {
      toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin),
      useNativeDriver: true, isInteraction: false,
    }));
    loop.start();
    return () => { loop.stop(); progress.setValue(0); };
  }, [animate, progress]);

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: visible ? 1 : 0 }}>
        <ShimmerContext.Provider value={animate ? progress : null}>{placeholder}</ShimmerContext.Provider>
      </View>
    </View>
  );
}

/** Shape matches the arriving content. Outside Skeleton it remains static. */
export function SkeletonBlock({ width = '100%', height = 16, radius = 6 }: SkeletonBlockProps) {
  const theme = useTheme();
  const progress = useContext(ShimmerContext);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  return (
    <View
      accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
      onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)}
      style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: theme.border.default }}
    >
      {progress && measuredWidth > 0 ? (
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: measuredWidth, opacity: 0.07,
          transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-measuredWidth, measuredWidth] }) }] }}>
          <LinearGradient colors={['transparent', theme.text.primary, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      ) : null}
    </View>
  );
}
