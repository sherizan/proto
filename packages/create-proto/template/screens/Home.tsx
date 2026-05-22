import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Screen, Stack, Text, Card, Divider } from '../components/proto';

export default function Home() {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });
  }, [opacity, translateY]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Screen title="Proto" scrollable>
      <Stack gap={24} padding={20}>
        <Animated.View style={heroStyle}>
          <Card glass padding={24}>
            <Stack gap={12}>
              <Text size="title">You're in.</Text>
              <Text size="body" color="secondary">
                Every change you make appears here instantly — no refresh, no waiting.
              </Text>
            </Stack>
          </Card>
        </Animated.View>

        <Stack gap={12}>
          <Text size="headline">Next</Text>
          <Text size="body">Open a new terminal and run</Text>
          <Card padding={16}>
            <Text size="body" color="accent">claude</Text>
          </Card>
          <Text size="body">Then describe what you want</Text>
          <Card padding={16}>
            <Text size="body" color="accent">
              Add liquid glass bottom toolbar with placeholder screens
            </Text>
          </Card>
        </Stack>

        <Divider />

        <Text size="caption" color="secondary">
          Proto reads DESIGN.md before every change.
        </Text>
      </Stack>
    </Screen>
  );
}
