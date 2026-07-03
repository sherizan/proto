import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Row, Screen, Stack, Text } from 'proto-components';
import { useCallback, useState } from 'react';
import { getHistory, type OpenedProto } from '../../lib/open-history';
import { useMyShares } from '../../lib/use-my-shares';
import { parseShareLink } from '../../lib/share-link';
import { relativeTime } from '../../lib/relative-time';
import { AvatarButton, EmptyHint, OpenButton, TapCard } from '../../components/dashboard-ui';

export default function Shared() {
  const router = useRouter();
  const { shares } = useMyShares();
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
        <Row gap={12} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text size="title">Shared</Text>
          </View>
          <AvatarButton />
        </Row>

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
      </Stack>
    </Screen>
  );
}
