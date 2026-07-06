import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Button, Lottie, Screen, Stack, Text } from 'proto-components';
import { useEffect, useRef, useState } from 'react';
import { SignInScreen } from '../../components/SignInScreen';
import { useAuth } from '../../lib/auth-context';
import { loadPrototype } from '../../lib/native-runtime';
import { fetchShare } from '../../lib/share-lookup';
import { recordOpen } from '../../lib/open-history';

type Phase = { kind: 'resolving' } | { kind: 'error'; message: string };

function Loading() {
  return (
    <Screen scrollable={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Lottie source={require('../../assets/logo-prototo.json')} style={{ width: 72, height: 72 }} />
        <Text size="body" color="secondary">
          Protomaxxing..
        </Text>
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
  const opened = useRef(false);

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
              ? "This link has expired or doesn't exist."
              : result.reason === 'invalid'
                ? "This link isn't valid."
                : "Couldn't open this prototype. Check your connection and try again.",
        });
        return;
      }
      void recordOpen({ token, appName: result.share.appName });
      loadPrototype(result.share.deepLink);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session, token, phase.kind]);

  if (loading) {
    return <Loading />;
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
            <Text size="title">Can't open this prototype</Text>
            <Text size="body" color="secondary" style={{ textAlign: 'center' }}>
              {phase.message}
            </Text>
            <Stack gap={10} align="center" style={{ marginTop: 12, alignSelf: 'stretch' }}>
              <Button
                label="Try again"
                onPress={() => {
                  opened.current = false;
                  setPhase({ kind: 'resolving' });
                }}
                style={{ alignSelf: 'stretch' }}
              />
              {token ? (
                <Button
                  label="Watch in your browser"
                  variant="secondary"
                  onPress={() => void WebBrowser.openBrowserAsync(`https://prototo.app/p/${token}`)}
                  style={{ alignSelf: 'stretch' }}
                />
              ) : null}
              <Button
                label="My prototypes"
                variant="ghost"
                onPress={() => router.replace('/')}
              />
            </Stack>
          </Stack>
        </View>
      </Screen>
    );
  }

  return <Loading />;
}
