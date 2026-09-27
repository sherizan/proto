import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from 'proto-components';

const ACTION_WIDTH = 88;

// Swipe a row left to reveal a red delete pane; keep going (or tap it) to remove.
// The parent animates the row out (FadeOut) and its neighbours close the gap.
export function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const theme = useTheme();

  const renderRightActions = (progress: SharedValue<number>) => (
    <DeletePane progress={progress} color={theme.text.destructive} />
  );

  return (
    <Animated.View layout={LinearTransition.springify().damping(18)} exiting={FadeOut.duration(180)}>
      <ReanimatedSwipeable
        friction={1.6}
        rightThreshold={ACTION_WIDTH * 0.6}
        overshootRight={false}
        renderRightActions={renderRightActions}
        onSwipeableOpen={(direction) => {
          // The library names the direction the row moved, so a revealed right pane is 'left'.
          if (direction === 'left') onDelete();
        }}
      >
        {children}
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

function DeletePane({ progress, color }: { progress: SharedValue<number>; color: string }) {
  // Fixed width: the swipeable measures this container to know how far the row may travel.
  // The pane fades in and the icon pops as the row uncovers it.
  const pane = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25, 1], [0, 1, 1]),
  }));
  const icon = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 0.7, 1], [0.5, 1, 1.15]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: ACTION_WIDTH,
          marginLeft: 8,
          backgroundColor: color,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pane,
      ]}
    >
      <Animated.View style={icon}>
        <SymbolView name="trash.fill" size={22} tintColor="#FFFFFF" />
      </Animated.View>
    </Animated.View>
  );
}
