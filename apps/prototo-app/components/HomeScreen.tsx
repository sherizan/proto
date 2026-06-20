import { useRouter } from 'expo-router';
import { Button, Card, Screen, Stack, Text } from 'proto-components';
import { useAuth } from '../lib/auth-context';

export function HomeScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const name =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    session?.user.email ??
    'there';

  return (
    <Screen>
      <Stack gap={16} padding={24}>
        <Text size="title">Hi {name}</Text>

        <Card>
          <Stack gap={8}>
            <Text size="headline">Open a shared prototype</Text>
            <Text size="body" color="secondary">
              Paste a Prototo link to run it right here on your iPhone.
            </Text>
            <Button label="Open a link" variant="primary" onPress={() => {}} />
          </Stack>
        </Card>

        <Card>
          <Stack gap={8}>
            <Text size="headline">Connect to your Mac</Text>
            <Text size="body" color="secondary">
              Run proto start on your computer, then scan the QR to see your prototype live.
            </Text>
            <Button
              label="Scan QR code"
              variant="secondary"
              onPress={() => router.push('/connect')}
            />
          </Stack>
        </Card>

        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </Stack>
    </Screen>
  );
}
