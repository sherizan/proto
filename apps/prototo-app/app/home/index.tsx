import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Row, Screen, Stack, Text } from 'proto-components';
import { useAuth } from '../../lib/auth-context';
import { loadPrototype } from '../../lib/native-runtime';
import { useMyShares } from '../../lib/use-my-shares';
import { relativeTime } from '../../lib/relative-time';
import { SAMPLE } from '../../lib/sample';
import { AvatarButton, EmptyHint, OpenButton, TapCard } from '../../components/dashboard-ui';

export default function MyPrototypes() {
  const router = useRouter();
  const { session } = useAuth();
  const { shares, status } = useMyShares();
  const name =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    session?.user.email ??
    'there';

  return (
    <Screen>
      <Stack gap={24}>
        <Row gap={12} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text size="title">Hi {name}</Text>
          </View>
          <AvatarButton />
        </Row>

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
      </Stack>
    </Screen>
  );
}
