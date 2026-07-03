import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Button, Card, Row, Screen, Stack, Text, useAccent } from 'proto-components';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../lib/auth-context';
import { loadPrototype } from '../lib/native-runtime';
import { fetchMyShares, type MyShare } from '../lib/my-shares';
import { getHistory, type OpenedProto } from '../lib/open-history';
import { parseShareLink } from '../lib/share-link';
import { relativeTime } from '../lib/relative-time';
import { SAMPLE } from '../lib/sample';

function OpenButton({ onPress }: { onPress: () => void }) {
  return <Button label="Open" variant="secondary" onPress={onPress} />;
}

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

// Empty states are deliberately NOT cards — cards represent prototypes.
function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <Text size="body" color="secondary" style={{ paddingVertical: 8 }}>
      {children}
    </Text>
  );
}

export function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const accent = useAccent();
  const [linkError, setLinkError] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [shares, setShares] = useState<MyShare[]>([]);
  const [history, setHistory] = useState<OpenedProto[]>([]);

  const name =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    session?.user.email ??
    'there';
  const initial = name.charAt(0).toUpperCase();

  const ownedTokens = new Set(shares.map((s) => s.token));
  const openedShared = history.filter((p) => !ownedTokens.has(p.token));

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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getHistory().then((h) => {
        if (active) setHistory(h);
      });
      return () => {
        active = false;
      };
    }, []),
  );

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
          <TapCard
            title="sample-prototype"
            caption="See how Prototo looks"
            onPress={() => loadPrototype(SAMPLE.deepLink)}
            action={<OpenButton onPress={() => loadPrototype(SAMPLE.deepLink)} />}
          />
          {status === 'loading' ? (
            <EmptyHint>Loading…</EmptyHint>
          ) : shares.length === 0 ? (
            <EmptyHint>Run npx proto share to add your own.</EmptyHint>
          ) : (
            shares.map((s) => {
              const expired = new Date(s.expiresAt).getTime() < Date.now();
              return (
                <TapCard
                  key={s.token}
                  title={s.appName}
                  caption={expired ? `Expired · shared ${relativeTime(s.createdAt)}` : `Shared ${relativeTime(s.createdAt)}`}
                  onPress={() => router.push(`/p/${s.token}`)}
                  action={<OpenButton onPress={() => router.push(`/p/${s.token}`)} />}
                />
              );
            })
          )}
        </Stack>

        <Stack gap={8}>
          <Text size="label" color="secondary">
            SHARED PROTOTYPES
          </Text>
          {openedShared.length === 0 ? (
            <EmptyHint>Prototypes you open will show up here.</EmptyHint>
          ) : (
            openedShared.map((p) => (
              <TapCard
                key={p.token}
                title={p.appName}
                caption={`Opened ${relativeTime(p.openedAt)}`}
                onPress={() => router.push(`/p/${p.token}`)}
                action={<OpenButton onPress={() => router.push(`/p/${p.token}`)} />}
              />
            ))
          )}
        </Stack>

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
