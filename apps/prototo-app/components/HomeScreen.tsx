import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Button, Card, Row, Screen, Stack, Text, useAccent } from 'proto-components';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../lib/auth-context';
import { loadPrototype } from '../lib/native-runtime';
import { fetchMyShares, type MyShare } from '../lib/my-shares';
import { parseShareLink } from '../lib/share-link';
import { relativeTime } from '../lib/relative-time';
import { SAMPLE } from '../lib/sample';

const SHARED = { token: 'QEKY0W9ANVXY', url: 'https://prototo.app/p/QEKY0W9ANVXY' };

function TapCard({
  title,
  caption,
  onPress,
  action,
}: {
  title: string;
  caption?: string;
  onPress: () => void;
  action?: ReactNode;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card>
        <Row gap={12} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Stack gap={4}>
              <Text size="headline">{title}</Text>
              {caption ? (
                <Text size="caption" color="secondary">
                  {caption}
                </Text>
              ) : null}
            </Stack>
          </View>
          {action}
        </Row>
      </Card>
    </Pressable>
  );
}

export function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const accent = useAccent();
  const [linkError, setLinkError] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [shares, setShares] = useState<MyShare[]>([]);

  const name =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    session?.user.email ??
    'there';
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    const token = session?.access_token;
    if (!token) {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    fetchMyShares(token).then((res) => {
      if (cancelled) return;
      setShares(res.ok ? res.shares : []);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  async function onOpenLink() {
    setLinkError('');
    const copied = await Clipboard.getStringAsync();
    const token = parseShareLink(copied);
    if (!token) {
      setLinkError('Copy a Prototo link first, then tap Open a link.');
      return;
    }
    router.push(`/p/${token}`);
  }

  return (
    <Screen>
      <Stack gap={24}>
        <Row gap={12} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text size="title">Hi {name}</Text>
          </View>
          <Pressable onPress={() => router.push('/profile')} hitSlop={8} accessibilityLabel="Profile">
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text size="headline" style={{ color: '#FFFFFF' }}>
                {initial}
              </Text>
            </View>
          </Pressable>
        </Row>

        <Stack gap={8}>
          <Text size="label" color="secondary">
            MY PROTOTYPES
          </Text>
          {status === 'loading' ? (
            <Text size="body" color="secondary">
              Loading…
            </Text>
          ) : shares.length === 0 ? (
            <Card>
              <Stack gap={4}>
                <Text size="body">You have no prototypes shared yet.</Text>
                <Text size="caption" color="secondary">
                  Run npx proto share to share one.
                </Text>
              </Stack>
            </Card>
          ) : (
            shares.map((s) => {
              const expired = new Date(s.expiresAt).getTime() < Date.now();
              return (
                <TapCard
                  key={s.token}
                  title={s.appName}
                  caption={expired ? `Expired · shared ${relativeTime(s.createdAt)}` : `Shared ${relativeTime(s.createdAt)}`}
                  onPress={() => router.push(`/p/${s.token}`)}
                />
              );
            })
          )}
        </Stack>

        <Stack gap={8}>
          <Text size="label" color="secondary">
            SHARED PROTOTYPES
          </Text>
          <TapCard
            title="Shared prototype"
            onPress={() => router.push(`/p/${SHARED.token}`)}
            action={
              <Button label="Copy" variant="secondary" onPress={() => Clipboard.setStringAsync(SHARED.url)} />
            }
          />
        </Stack>

        <TapCard
          title="Sample Prototype"
          caption="See how Prototo looks"
          onPress={() => loadPrototype(SAMPLE.deepLink)}
        />

        <Card>
          <Stack gap={12}>
            <Text size="headline">Open a shared prototype</Text>
            <Text size="body" color="secondary">
              Copy a Prototo link, then tap to run it right here on your iPhone.
            </Text>
            <Button label="Open a link" variant="secondary" onPress={onOpenLink} />
            {linkError ? (
              <Text size="caption" color="destructive">
                {linkError}
              </Text>
            ) : null}
          </Stack>
        </Card>

        {__DEV__ ? (
          <Card>
            <Stack gap={12}>
              <Text size="headline">Connect to your Mac</Text>
              <Text size="body" color="secondary">
                Run proto start on your computer, then scan the QR to see your prototype live.
              </Text>
              <Button label="Scan QR code" variant="secondary" onPress={() => router.push('/connect')} />
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </Screen>
  );
}
