import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Lottie, Screen, Stack, Text } from 'proto-components';
import { useCallback, useState } from 'react';
import { loadPrototype } from '../../lib/native-runtime';
import { useMyShares } from '../../lib/use-my-shares';
import { getHistory, type OpenedProto } from '../../lib/open-history';
import { parseShareLink } from '../../lib/share-link';
import { relativeTime } from '../../lib/relative-time';
import { SAMPLE } from '../../lib/sample';
import { InfoCard, OpenButton, Segmented, TapCard } from '../../components/dashboard-ui';

// ponytail: paused, not removed — flip back on when the Mac connect flow returns
const SHOW_CONNECT_CARD = false;

export default function Prototypes() {
  const router = useRouter();
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
        <Lottie source={require('../../assets/logo-prototo.json')} style={{ width: 36, height: 36, alignSelf: 'center' }} />
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
                <InfoCard>Loading…</InfoCard>
              ) : shares.length === 0 ? (
                <InfoCard>Hit Publish in Desktop app to view your prototypes here.</InfoCard>
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

            {SHOW_CONNECT_CARD ? (
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
            <Card>
              <Stack gap={12}>
                <Text size="headline">Open a shared prototype</Text>
                <Text size="body" color="secondary">
                  Copy a Prototo link, then tap to run it right here on your iPhone.
                </Text>
                <Button label="Open a link" variant="primary" onPress={onOpenLink} />
                {linkError ? (
                  <Text size="caption" color="destructive">
                    {linkError}
                  </Text>
                ) : null}
              </Stack>
            </Card>

            <Stack gap={8}>
              {openedShared.length === 0 ? (
                <InfoCard>Prototypes you open will show up here.</InfoCard>
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
          </>
        )}
      </Stack>
    </Screen>
  );
}
