import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Lottie, Screen, Stack, Text, useAccent, useTheme } from 'proto-components';
import { useEffect, useRef, useState } from 'react';
import * as Updates from 'expo-updates';
import { SignInScreen } from '../../components/SignInScreen';
import { useAuth } from '../../lib/auth-context';
import { loadPrototype, onLoadFailed, onLoadProgress } from '../../lib/native-runtime';
import { fetchManifestRuntimeVersion, fetchShare } from '../../lib/share-lookup';
import { recordOpen } from '../../lib/open-history';

// `stale` = published against an older Prototo runtime — retrying or streaming
// in the browser won't help; only a re-publish by the owner fixes it.
type Phase = { kind: 'resolving' } | { kind: 'error'; message: string; stale?: boolean };

function Loading({ progress, onCancel }: { progress?: number | null; onCancel: () => void }) {
  const theme = useTheme();
  const accent = useAccent();
  const percent = progress != null ? Math.round(progress * 100) : null;
  return (
    <Screen scrollable={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <Lottie source={require('../../assets/logo-prototo.json')} style={{ width: 72, height: 72 }} />
        <Stack gap={4} align="center">
          <Text size="headline">Opening prototype…</Text>
          <Text size="body" color="secondary">
            {percent != null ? `Downloading ${percent}%` : 'This only takes a moment.'}
          </Text>
        </Stack>
        {percent != null ? (
          <View
            style={{
              width: 200,
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.surface.secondary,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${percent}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: accent,
              }}
            />
          </View>
        ) : null}
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Screen>
  );
}

export default function SharedPrototype() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { session, loading } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'resolving' });
  const [progress, setProgress] = useState<number | null>(null);
  const opened = useRef(false);

  // Native load feedback: real per-asset download progress, and failures that
  // previously left this screen on an indefinite spinner.
  useEffect(() => {
    const offProgress = onLoadProgress(({ successful, total }) => {
      if (total > 0) setProgress(successful / total);
    });
    const offFailed = onLoadFailed(() => {
      opened.current = false;
      setProgress(null);
      setPhase({
        kind: 'error',
        message: "Couldn't load this prototype. Check your connection and try again.",
      });
    });
    return () => {
      offProgress();
      offFailed();
    };
  }, []);

  // Watchdog: whatever stalls (a lost native load, a download that never sends
  // its first progress event), the user gets a retry instead of an eternal
  // spinner. Each progress event buys another window.
  useEffect(() => {
    if (loading || !session || phase.kind !== 'resolving') return;
    const timer = setTimeout(() => {
      opened.current = false;
      setProgress(null);
      setPhase({
        kind: 'error',
        message: 'This is taking longer than it should. Check your connection and try again.',
      });
    }, 30_000);
    return () => clearTimeout(timer);
  }, [loading, session, phase.kind, progress]);

  useEffect(() => {
    if (loading || !session || !token || opened.current) return;
    if (phase.kind !== 'resolving') return;
    opened.current = true;
    let cancelled = false;
    (async () => {
      const result = await fetchShare(token);
      if (cancelled) {
        opened.current = false;
        return;
      }
      if (!result.ok) {
        opened.current = false;
        setPhase({
          kind: 'error',
          message:
            result.reason === 'not-found'
              ? "This prototype doesn't exist or was removed."
              : result.reason === 'invalid'
                ? "This link isn't valid."
                : "Couldn't open this prototype. Check your connection and try again.",
        });
        return;
      }
      const published = await fetchManifestRuntimeVersion(result.share.deepLink);
      if (cancelled) {
        opened.current = false;
        return;
      }
      const own = Updates.runtimeVersion;
      if (published && own && published !== own) {
        opened.current = false;
        setPhase({
          kind: 'error',
          stale: true,
          message: `This prototype was made with an older version of Prototo. Ask ${result.share.designerName} to publish it again.`,
        });
        return;
      }
      void recordOpen({ token, appName: result.share.appName, designerName: result.share.designerName });
      loadPrototype(result.share.deepLink);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session, token, phase.kind]);

  if (loading) {
    return <Loading onCancel={() => router.replace('/')} />;
  }

  if (!session) {
    return <SignInScreen />;
  }

  if (phase.kind === 'error') {
    return (
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Stack gap={12} align="center">
            <Lottie
              source={require('../../assets/logo-prototo.json')}
              style={{ width: 56, height: 56 }}
            />
            <Text size="headline">Can't open this prototype</Text>
            <Text size="body" color="secondary" style={{ textAlign: 'center' }}>
              {phase.message}
            </Text>
            <Stack gap={10} style={{ marginTop: 12, alignSelf: 'stretch' }}>
              {phase.stale ? null : (
                <Button
                  label="Try again"
                  variant="primary"
                  onPress={() => {
                    opened.current = false;
                    setProgress(null);
                    setPhase({ kind: 'resolving' });
                  }}
                />
              )}
              <Button
                label="Back to home"
                variant="ghost"
                onPress={() => router.replace('/')}
              />
            </Stack>
          </Stack>
        </View>
      </Screen>
    );
  }

  return <Loading progress={progress} onCancel={() => router.replace('/')} />;
}
