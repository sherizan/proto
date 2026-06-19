import { Screen, Stack, Text } from 'proto-components';
import { HomeScreen } from '../components/HomeScreen';
import { SignInScreen } from '../components/SignInScreen';
import { useAuth } from '../lib/auth-context';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <Screen scrollable={false}>
        <Stack gap={8} padding={24}>
          <Text size="title">Prototo</Text>
        </Stack>
      </Screen>
    );
  }

  return session ? <HomeScreen /> : <SignInScreen />;
}
