import { useEffect, useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';
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
import { Screen, Stack, Text, Card, Divider, Lottie } from '../components/proto';

// Prototo Desktop sets EXPO_PUBLIC_PROTO_DESKTOP=1 when it runs `proto start`
// (Metro inlines it at bundle time). In the desktop the terminal sits beside
// this preview with the coding agent already running, and the simulator
// clipboard never reaches the Mac, so the copy and Copy affordance both change.
const IN_DESKTOP = process.env.EXPO_PUBLIC_PROTO_DESKTOP === '1';

const EXAMPLES = [
  {
    label: 'A whole screen',
    prompt: 'Make me a music player home screen',
  },
  {
    label: 'Native feel',
    prompt: 'Add a liquid glass tab bar with Home, Search, Profile',
  },
  {
    label: 'A quick change',
    prompt: 'Make the background sunset orange',
  },
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
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(example.prompt);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card padding={20}>
      <Stack gap={6}>
        <Text size="label" color="accent">
          {example.label}
        </Text>
        <Text size="headline">{`"${example.prompt}"`}</Text>
        {IN_DESKTOP ? null : (
          <Pressable onPress={handleCopy} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
            <Text size="caption" color="accent">
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </Pressable>
        )}
      </Stack>
    </Card>
  );
}

export default function Home() {
  return (
    <Screen scrollable>
      <Stack gap={24}>
        <Enter delay={0}>
          <Lottie
            source={require('../assets/lottie/logo-prototo.json')}
            style={{ width: 56, height: 56, alignSelf: 'center' }}
          />
        </Enter>

        <Enter delay={80}>
          <Card glass padding={24}>
            <Stack gap={8}>
              <Text size="headline">You're in.</Text>
              <Text size="body" color="secondary">
                {IN_DESKTOP
                  ? 'Type your first prompt in the terminal beside this preview, and watch it appear here.'
                  : `In a terminal: cd {{APP_NAME}} && claude (or codex). Then paste a prompt below.`}
              </Text>
            </Stack>
          </Card>
        </Enter>

        <Enter delay={160}>
          <Stack gap={12}>
            <Text size="label" color="secondary">
              Try one of these
            </Text>
            {EXAMPLES.map((example) => (
              <ExampleCard key={example.label} example={example} />
            ))}
          </Stack>
        </Enter>

        <Enter delay={240}>
          <Stack gap={16}>
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
