import { Redirect } from 'expo-router';
import { Lottie, Screen } from 'proto-components';
import { View } from 'react-native';
import { SignInScreen } from '../components/SignInScreen';
import { useAuth } from '../lib/auth-context';

export default function Index() {
  const { session, loading } = useAuth();

  // Session restore takes a beat on cold start: a bare centered logo, nothing
  // else, so it reads as the launch moment rather than an abandoned page.
  if (loading) {
    return (
      <Screen scrollable={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Lottie source={require('../assets/logo-prototo.json')} style={{ width: 72, height: 72 }} />
        </View>
      </Screen>
    );
  }

  if (!session) {
    return <SignInScreen />;
  }

  return <Redirect href="/home" />;
}
