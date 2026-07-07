import { CameraView, useCameraPermissions } from 'expo-camera';
import { GlassView } from 'expo-glass-effect';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Button, Screen, Stack, Text } from 'proto-components';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { detectClipboardShare } from '../lib/clipboard-share';
import { parseConnectUrl } from '../lib/connect-url';
import { loadPrototype } from '../lib/native-runtime';
import { parseShareLink } from '../lib/share-link';
import { fetchShare } from '../lib/share-lookup';

export default function Connect() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const handled = useRef(false);
  const errorShown = useRef(false);

  const [clip, setClip] = useState<{ token: string; name: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    void detectClipboardShare().then(async (token) => {
      if (!token || !active) return;
      const res = await fetchShare(token);
      if (active) setClip({ token, name: res.ok ? res.share.appName : null });
    });
    return () => {
      active = false;
    };
  }, []);

  const slotOpacity = useSharedValue(0);
  useEffect(() => {
    slotOpacity.value = withTiming(1, {
      duration: 350,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  }, [clip, slotOpacity]);
  const slotStyle = useAnimatedStyle(() => ({ opacity: slotOpacity.value }));

  if (!permission) {
    return (
      <Screen scrollable={false}>
        <Stack gap={8} padding={24}>
          <Text size="body" color="secondary">
            Preparing the camera…
          </Text>
        </Stack>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen scrollable={false}>
        <Stack gap={16} padding={24}>
          <Text size="title">Scan to connect</Text>
          <Text size="body" color="secondary">
            Prototo needs your camera to scan a prototype's QR code.
          </Text>
          {permission.canAskAgain ? (
            <Button label="Allow camera" variant="primary" onPress={requestPermission} />
          ) : (
            <Button
              label="Open Settings"
              variant="primary"
              onPress={() => Linking.openSettings()}
            />
          )}
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </Stack>
      </Screen>
    );
  }

  function onBarcodeScanned(result: { data: string }) {
    if (handled.current) return;

    const shareToken = parseShareLink(result.data);
    if (shareToken) {
      handled.current = true;
      router.replace(`/p/${shareToken}`);
      return;
    }

    const url = parseConnectUrl(result.data);
    if (!url) {
      if (!errorShown.current) {
        errorShown.current = true;
        setError("That's not a Prototo QR code. Point your camera at a Prototo QR or share link.");
      }
      return;
    }
    handled.current = true;
    loadPrototype(url);
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.fill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={onBarcodeScanned}
      />
      <View style={styles.overlay}>
        <Stack gap={8}>
          <Text size="headline">Point at the QR code</Text>
          <Text size="body" color="secondary">
            Scan the code from proto start, or a Prototo share link.
          </Text>
          {error ? (
            <Text size="caption" color="destructive">
              {error}
            </Text>
          ) : null}
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </Stack>
      </View>
      <Animated.View style={[styles.slot, slotStyle]}>
        {clip ? (
          <GlassView style={styles.slotCard}>
            <View style={styles.slotRow}>
              <Text size="body">Link on your clipboard</Text>
              <Button
                label={clip.name ? `Open ${clip.name}` : 'Open link'}
                variant="primary"
                onPress={() => router.replace(`/p/${clip.token}`)}
              />
            </View>
          </GlassView>
        ) : (
          <Text size="caption" color="secondary" style={styles.slotHint}>
            Copy a Prototo link and it appears here.
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    // Cleared above the clipboard slot below so the two overlays never overlap.
    bottom: 132,
  },
  slot: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  slotCard: { borderRadius: 16, overflow: 'hidden' },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 10,
  },
  slotHint: { textAlign: 'center' },
});
