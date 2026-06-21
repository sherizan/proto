import { useLocalSearchParams } from 'expo-router';
import { Screen, Stack, Text } from 'proto-components';
import { useEffect, useRef, useState } from 'react';
import { SignInScreen } from '../../components/SignInScreen';
import { useAuth } from '../../lib/auth-context';
import { loadPrototype } from '../../lib/native-runtime';
import { fetchShare } from '../../lib/share-lookup';

type Phase = { kind: 'resolving' } | { kind: 'error'; message: string };

export default function SharedPrototype() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { session, loading } = useAuth();
  const [phase, setPhase] = useState<Phase>({ kind: 'resolving' });
  const opened = useRef(false);

  useEffect(() => {
    if (loading || !session || !token || opened.current) return;
    opened.current = true;
    let cancelled = false;
    setPhase({ kind: 'resolving' });
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
      loadPrototype(result.share.deepLink);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session, token]);

  if (loading) {
    return (
      <Screen scrollable={false}>
        <Stack gap={8} padding={24}>
          <Text size="body" color="secondary">
            Loading…
          </Text>
        </Stack>
      </Screen>
    );
  }

  if (!session) {
    return <SignInScreen />;
  }

  if (phase.kind === 'error') {
    return (
      <Screen scrollable={false}>
        <Stack gap={16} padding={24}>
          <Text size="title">Can't open this prototype</Text>
          <Text size="body" color="secondary">
            {phase.message}
          </Text>
        </Stack>
      </Screen>
    );
  }

  return (
    <Screen scrollable={false}>
      <Stack gap={8} padding={24}>
        <Text size="headline">Opening the prototype…</Text>
        <Text size="body" color="secondary">
          This takes a moment.
        </Text>
      </Stack>
    </Screen>
  );
}
