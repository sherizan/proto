import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  Animated,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from '../components/proto/gestures';
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

function TutorialCard({ step }: { step: (typeof STEPS)[number] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(step.prompt);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card padding={20}>
      <Stack gap={10}>
        <Row gap={10} align="center">
          <Text size="headline">{step.n}.</Text>
          <Text size="headline">{step.title}</Text>
        </Row>
        <Text size="body" color="secondary">{step.prompt}</Text>
        <Pressable onPress={handleCopy} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
          <Text size="caption" color="accent">{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
      </Stack>
    </Card>
  );
}

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
      <Stack gap={24}>
        <Animated.View style={heroStyle}>
          <Card glass padding={24}>
            <Stack gap={8}>
              <Text size="headline">You're in.</Text>
              <Text size="body" color="secondary">
                {`In a terminal: cd {{APP_NAME}} && claude. Paste a prompt below.`}
              </Text>
            </Stack>
          </Card>
        </Animated.View>

        <Stack gap={12}>
          {STEPS.map((step) => (
            <TutorialCard key={step.n} step={step} />
          ))}
        </Stack>

        <Divider />

        <Text size="caption" color="secondary">
          Each prompt builds on the last. Prototo reads DESIGN.md before every change.
        </Text>
      </Stack>
    </Screen>
  );
}
