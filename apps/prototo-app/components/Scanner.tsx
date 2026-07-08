import { CameraView, useCameraPermissions } from 'expo-camera';
import { GlassView } from 'expo-glass-effect';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Button, Screen, Stack, Text } from 'proto-components';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { detectClipboardShare } from '../lib/clipboard-share';
import { parseConnectUrl } from '../lib/connect-url';
import { loadPrototype } from '../lib/native-runtime';
import { parseShareLink } from '../lib/share-link';
import { fetchShare } from '../lib/share-lookup';

// The single "get me in" surface: camera + clipboard slot. Used by the Scan
// tab (active follows tab focus so the camera never runs in a background tab)
// and by the pushed /connect route (deep links; shows Cancel).
export function Scanner({
  active,
  showCancel = false,
  clearTabBar = false,
  onCancel,
}: {
  active: boolean;
  showCancel?: boolean;
  /** In-tab use: lift the bottom slot above the native Liquid Glass tab bar. */
  clearTabBar?: boolean;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slotBottom = clearTabBar ? insets.bottom + 88 : insets.bottom + 24;
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const handled = useRef(false);
  const errorShown = useRef(false);

  const [clip, setClip] = useState<{ token: string; name: string | null } | null>(null);

  // Re-check the clipboard each time the scanner becomes active (tab focus /
  // mount) — the user may have copied a link since the last look.
  useEffect(() => {
    if (!active) return;
    // A fresh activation may also follow a completed navigation: re-arm.
    handled.current = false;
    let live = true;
    void detectClipboardShare().then(async (token) => {
      if (!token || !live) return;
      const res = await fetchShare(token);
      if (live) setClip({ token, name: res.ok ? res.share.appName : null });
    });
    return () => {
      live = false;
    };
  }, [active]);

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
          <Text size="title">Scan to open</Text>
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
          {showCancel && onCancel ? (
            <Button label="Cancel" variant="ghost" onPress={onCancel} />
          ) : null}
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
      {active ? (
        <CameraView
          style={styles.fill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onBarcodeScanned}
        />
      ) : (
        <View style={styles.fill} />
      )}
      <View style={[styles.overlay, { top: insets.top + 20 }]}>
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
          {showCancel && onCancel ? (
            <Button label="Cancel" variant="ghost" onPress={onCancel} style={{ alignSelf: 'flex-start' }} />
          ) : null}
        </Stack>
      </View>
      <Animated.View style={[styles.slot, { bottom: slotBottom }, slotStyle]}>
        {clip ? (
          <GlassView style={styles.slotCard}>
            <View style={styles.slotRow}>
              <Text size="body">Link on your clipboard</Text>
              <Button
                label={clip.name ? `Open ${clip.name}` : 'Open link'}
                variant="primary"
                onPress={() => {
                  if (handled.current) return;
                  handled.current = true;
                  router.replace(`/p/${clip.token}`);
                }}
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
  // Instructions live at the TOP (the bottom belongs to the clipboard slot and,
  // in-tab, the native tab bar).
  overlay: {
    position: 'absolute',
    left: 24,
    right: 24,
  },
  slot: {
    position: 'absolute',
    left: 16,
    right: 16,
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
