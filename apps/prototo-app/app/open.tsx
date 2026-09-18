import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Lottie, Screen, Stack, Text } from 'proto-components';
import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { parseConnectUrl } from '../lib/connect-url';
import { loadPrototype, onLoadFailed, onLoadProgress } from '../lib/native-runtime';

// Opening a prototype from a designer's Mac (Metro) — the desktop "Preview on
// iPhone" QR, proto start's QR, or the Camera app handing us that link. The
// native load used to fire with no screen behind it, so a phone that couldn't
// reach the Mac showed nothing at all. This screen owns the wait + the failure.
type Phase = { kind: 'connecting' } | { kind: 'error'; message: string };

const NOT_A_QR = "That's not a Prototo QR code. Point your camera at a Prototo QR or share link.";
// The two things that block a phone→Mac connect while the internet still
// works: a different Wi-Fi (or one that isolates clients), and iOS's per-app
// Local Network permission (Settings → Prototo → Local Network).
const UNREACHABLE =
  "Couldn't reach your Mac's preview. Make sure this iPhone is on the same Wi-Fi as the Mac, and that Local Network is allowed for Prototo in Settings.";

export default function OpenFromMac() {
  const params = useLocalSearchParams<{ url?: string | string[] }>();
  const raw = Array.isArray(params.url) ? params.url[0] : params.url;
  const target = raw ? parseConnectUrl(raw) : null;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    target ? { kind: 'connecting' } : { kind: 'error', message: NOT_A_QR },
  );
  const [progress, setProgress] = useState<number | null>(null);
  const attempt = useRef(0);

  useEffect(() => {
    if (!target || phase.kind !== 'connecting') return;
    const offProgress = onLoadProgress(({ successful, total }) => {
      if (total > 0) setProgress(successful / total);
    });
    const offFailed = onLoadFailed(() => {
      setProgress(null);
      setPhase({ kind: 'error', message: UNREACHABLE });
    });
    // Metro connects are fast; anything stuck past this is a dead link, not a
    // slow one — give the person a retry instead of an endless spinner.
    const watchdog = setTimeout(() => setPhase({ kind: 'error', message: UNREACHABLE }), 30_000);
    loadPrototype(target);
    return () => {
      offProgress();
      offFailed();
      clearTimeout(watchdog);
    };
    // attempt.current changes re-run the effect on Try again
  }, [target, phase.kind, attempt.current]);

  return (
    <Screen scrollable={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Lottie source={require('../assets/logo-prototo.json')} style={{ width: 72, height: 72 }} />
        {phase.kind === 'connecting' ? (
          <Stack gap={4} align="center">
            <Text size="headline">Connecting to your Mac…</Text>
            <Text size="body" color="secondary">
              {progress != null ? `Loading ${Math.round(progress * 100)}%` : 'This only takes a moment.'}
            </Text>
          </Stack>
        ) : (
          <Stack gap={12} align="center">
            <Text size="headline">Can't open this preview</Text>
            <Text size="body" color="secondary" style={{ textAlign: 'center' }}>
              {phase.message}
            </Text>
          </Stack>
        )}
        <Stack gap={10} style={{ marginTop: 12, alignSelf: 'stretch' }}>
          {phase.kind === 'error' && target ? (
            <>
              <Button
                label="Try again"
                variant="primary"
                onPress={() => {
                  attempt.current += 1;
                  setPhase({ kind: 'connecting' });
                }}
              />
              <Button
                label="Open Settings"
                variant="secondary"
                onPress={() => {
                  void Linking.openSettings();
                }}
              />
            </>
          ) : null}
          <Button
            label={phase.kind === 'error' ? 'Back to home' : 'Cancel'}
            variant="ghost"
            onPress={() => router.replace('/')}
          />
        </Stack>
      </View>
    </Screen>
  );
}
