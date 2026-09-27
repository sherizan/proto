import { useEffect, type ReactNode } from 'react';
import { SymbolView } from 'expo-symbols';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  Animated,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from '../components/proto/gestures';
import { Screen, Stack, Row, Text, Card, Button, Divider, Lottie, useAccent } from '../components/proto';

// Prototo Desktop sets EXPO_PUBLIC_PROTO_DESKTOP=1 when it runs `proto start`
// (Metro inlines it at bundle time). In the desktop the terminal sits beside
// this preview with the coding agent already running, and the simulator
// clipboard never reaches the Mac, so the copy and Copy affordance both change.
const IN_DESKTOP = process.env.EXPO_PUBLIC_PROTO_DESKTOP === '1';

const EXAMPLES = [
  { label: 'A whole screen', prompt: 'Make me a music player home screen' },
  { label: 'Native feel', prompt: 'Add a liquid glass tab bar with Home, Search, Profile' },
  { label: 'A quick change', prompt: 'Make the background sunset orange' },
];

function Enter({ delay, children }: { delay: number; children: ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    const timing = { duration: 500, easing: Easing.out(Easing.quad) };
    opacity.value = withDelay(delay, withTiming(1, timing));
    translateY.value = withDelay(delay, withTiming(0, timing));
  }, [delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

function ExampleCard({ example }: { example: (typeof EXAMPLES)[number] }) {
  const accent = useAccent();

  const handleCopy = async () => {
    await Clipboard.setStringAsync(example.prompt);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Card glass padding={16}>
      <Row gap={14} align="center">
        <SymbolView name="text.bubble" size={22} tintColor={accent} />
        <Stack gap={2} style={{ flex: 1 }}>
          <Text size="label" color="accent">
            {example.label}
          </Text>
          <Text size="body">{`“${example.prompt}”`}</Text>
        </Stack>
        {IN_DESKTOP ? null : (
          <Row>
            <Button label="Copy" variant="ghost" onPress={() => void handleCopy()} />
          </Row>
        )}
      </Row>
    </Card>
  );
}

export default function Home() {
  return (
    <Screen scrollable gradient>
      <Stack gap={24}>
        <Enter delay={0}>
          <Card glass padding={24}>
            <Row gap={16} align="center">
              <Lottie
                source={require('../assets/lottie/logo-prototo.json')}
                style={{ width: 48, height: 48 }}
              />
              <Stack gap={4} style={{ flex: 1 }}>
                <Text size="headline">You're in.</Text>
                <Text size="body" color="secondary">
                  {IN_DESKTOP
                    ? 'Describe a screen in the terminal beside this preview. It appears here as it builds.'
                    : `In a terminal: cd {{APP_NAME}} && claude (or codex). Then paste a prompt below.`}
                </Text>
              </Stack>
            </Row>
          </Card>
        </Enter>

        <Enter delay={120}>
          <Stack gap={10}>
            <Text size="label" color="secondary">
              Try one of these
            </Text>
            {EXAMPLES.map((example) => (
              <ExampleCard key={example.label} example={example} />
            ))}
          </Stack>
        </Enter>

        <Enter delay={240}>
          <Stack gap={12}>
            <Divider />
            <Text size="caption" color="secondary">
              Each prompt builds on the last. Prototo reads DESIGN.md before every change.
            </Text>
          </Stack>
        </Enter>
      </Stack>
    </Screen>
  );
}
