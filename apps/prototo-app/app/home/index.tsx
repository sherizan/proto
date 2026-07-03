import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Screen, Stack, Text } from 'proto-components';
import { useCallback, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { loadPrototype } from '../../lib/native-runtime';
import { useMyShares } from '../../lib/use-my-shares';
import { getHistory, type OpenedProto } from '../../lib/open-history';
import { parseShareLink } from '../../lib/share-link';
import { relativeTime } from '../../lib/relative-time';
import { SAMPLE } from '../../lib/sample';
import { EmptyHint, OpenButton, Segmented, TapCard } from '../../components/dashboard-ui';

export default function Prototypes() {
  const router = useRouter();
  const { session } = useAuth();
  const { shares, status } = useMyShares();
  const [tab, setTab] = useState(0);
  const [history, setHistory] = useState<OpenedProto[]>([]);
  const [linkError, setLinkError] = useState('');

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

  const name =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    session?.user.email ??
    'there';
  const ownedTokens = new Set(shares.map((s) => s.token));
  const openedShared = history.filter((p) => !ownedTokens.has(p.token));

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
        <Text size="title">Hi {name}</Text>
        <Segmented options={['Mine', 'Shared']} index={tab} onChange={setTab} />

        {tab === 0 ? (
          <>
            <Stack gap={8}>
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
          </>
        ) : (
          <>
            <Stack gap={8}>
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
          </>
        )}
      </Stack>
    </Screen>
  );
}
