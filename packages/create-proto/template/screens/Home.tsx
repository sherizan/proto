import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Screen, Stack, Row, Text, Card, Divider } from '../components/proto';

const STEPS = [
  {
    n: '1',
    title: 'Change background color',
    prompt: 'Fill background to light teal covering safe area top and bottom.',
  },
  {
    n: '2',
    title: 'Add a native component',
    prompt: 'add a liquid glass bottom tab bar with Home, Explore, About tabs',
  },
];

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
    <Screen scrollable>
      <Stack gap={24} padding={20}>
        <Animated.View style={heroStyle}>
          <Card glass padding={24}>
            <Stack gap={8}>
              <Text size="title">You're in.</Text>
              <Text size="body" color="secondary">
                Try these prompts in Claude Code in Auto mode (press Shift+Tab).
              </Text>
            </Stack>
          </Card>
        </Animated.View>

        <Stack gap={12}>
          {STEPS.map((step) => (
            <Card key={step.n} padding={20}>
              <Stack gap={10}>
                <Row gap={10} align="center">
                  <Text size="headline" color="accent">{step.n}.</Text>
                  <Text size="headline">{step.title}</Text>
                </Row>
                <Text size="body" color="accent" style={{ fontFamily: 'Menlo' }}>
                  {step.prompt}
                </Text>
              </Stack>
            </Card>
          ))}
        </Stack>

        <Divider />

        <Text size="caption" color="secondary">
          Each prompt builds on the last. Proto reads DESIGN.md before every change.
        </Text>
      </Stack>
    </Screen>
  );
}
