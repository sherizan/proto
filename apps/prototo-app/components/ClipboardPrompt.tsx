import { GlassView } from 'expo-glass-effect';
import { usePathname, useRouter } from 'expo-router';
import { Button, Stack, Text } from 'proto-components';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { detectClipboardShare, rememberDecline, wasDeclined } from '../lib/clipboard-share';
import { fetchShare } from '../lib/share-lookup';

// App-open clipboard detection (spec §App-open clipboard prompt): if the user
// copied a Prototo link, offer it in one tap. hasUrl gate keeps iOS quiet
// until there is actually a URL to look at.
export function ClipboardPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<{ token: string; name: string | null } | null>(null);
  const checking = useRef(false);
  const pathnameRef = useRef(pathname);
  const promptVisibleRef = useRef(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  });

  const check = useCallback(async () => {
    if (checking.current || promptVisibleRef.current) return;
    checking.current = true;
    try {
      const token = await detectClipboardShare();
      if (!token || (await wasDeclined(token))) return;
      if (pathnameRef.current === `/p/${token}`) return; // already looking at it
      const res = await fetchShare(token);
      promptVisibleRef.current = true;
      setPrompt({ token, name: res.ok ? res.share.appName : null });
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  useEffect(() => {
    const timing = { duration: 320, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System };
    opacity.value = withTiming(prompt ? 1 : 0, timing);
    translateY.value = withTiming(prompt ? 0 : 16, timing);
  }, [prompt, opacity, translateY]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!prompt) return null;

  const dismiss = async () => {
    await rememberDecline(prompt.token);
    promptVisibleRef.current = false;
    setPrompt(null);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={cardStyle}>
          <GlassView style={styles.card}>
            <Stack gap={12}>
              <Text size="headline">{prompt.name ? `Open ${prompt.name}?` : 'Open your copied link?'}</Text>
              <Text size="body" color="secondary">
                You copied a Prototo link.
              </Text>
              <Stack gap={8}>
                <Button
                  label="Open"
                  variant="primary"
                  onPress={() => {
                    const token = prompt.token;
                    promptVisibleRef.current = false;
                    setPrompt(null);
                    router.push(`/p/${token}`);
                  }}
                />
                <Button label="Not now" variant="ghost" onPress={() => void dismiss()} />
              </Stack>
            </Stack>
          </GlassView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 32,
  },
  card: { borderRadius: 20, padding: 20, overflow: 'hidden' },
});
