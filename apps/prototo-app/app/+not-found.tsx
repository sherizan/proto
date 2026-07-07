import { Redirect, useRouter } from 'expo-router';
import { useLinkingURL } from 'expo-linking';
import { View } from 'react-native';
import { Button, Lottie, Screen, Stack, Text } from 'proto-components';
import { parseShareLink } from '../lib/share-link';

// iOS re-emits an already-opened universal link in scheme-normalized form
// (prototo:///p/<token>), which expo-router can't match, so it stacks its
// not-found route over the correctly resolved share screen. Recover any URL
// that parses as a share link by re-routing to it; everything else gets a
// branded dead end instead of expo-router's debug screen.
export default function NotFound() {
  const url = useLinkingURL();
  const router = useRouter();
  const token = url ? parseShareLink(url) : null;

  if (token) {
    return <Redirect href={`/p/${token}`} />;
  }

  return (
    <Screen scrollable={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack gap={12} align="center">
          <Lottie
            source={require('../assets/logo-prototo.json')}
            style={{ width: 56, height: 56 }}
          />
          <Text size="title">Nothing to open here</Text>
          <Text size="body" color="secondary" style={{ textAlign: 'center' }}>
            This link doesn't match anything in Prototo.
          </Text>
          <Button label="Go home" onPress={() => router.replace('/')} style={{ marginTop: 12 }} />
        </Stack>
      </View>
    </Screen>
  );
}
