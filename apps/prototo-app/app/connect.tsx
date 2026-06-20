import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Button, Screen, Stack, Text } from 'proto-components';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { parseConnectUrl } from '../lib/connect-url';

export default function Connect() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const handled = useRef(false);
  const errorShown = useRef(false);

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
            Prototo needs your camera to scan the QR code from proto start.
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

  async function onBarcodeScanned(result: { data: string }) {
    if (handled.current) return;
    const url = parseConnectUrl(result.data);
    if (!url) {
      if (!errorShown.current) {
        errorShown.current = true;
        setError("That's not a Prototo QR code. Point your camera at the code from proto start.");
      }
      return;
    }
    handled.current = true;
    try {
      const opened = await Linking.openURL(url);
      if (!opened) throw new Error('not opened');
    } catch {
      handled.current = false;
      setError('Could not connect. Make sure proto start is still running and try again.');
    }
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
            It's printed in your terminal after you run proto start.
          </Text>
          {error ? (
            <Text size="caption" color="destructive">
              {error}
            </Text>
          ) : null}
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 48,
  },
});
