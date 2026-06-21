import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { Screen, Stack, Text } from 'proto-components';
import { appleSignInErrorMessage } from '../lib/apple-auth';
import { useAuth } from '../lib/auth-context';

export function SignInScreen() {
  const { signInWithApple } = useAuth();
  const [error, setError] = useState('');

  async function onApplePress() {
    setError('');
    try {
      await signInWithApple();
    } catch (e) {
      setError(appleSignInErrorMessage((e as { code?: string })?.code));
    }
  }

  return (
    <Screen scrollable={false}>
      <Stack gap={32} padding={24}>
        <Stack gap={8}>
          <Text size="title">Prototo</Text>
          <Text size="body" color="secondary">
            Run real native prototypes on your iPhone — open one a teammate shared, or
            preview your own.
          </Text>
        </Stack>
        <Stack gap={12}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={{ height: 52 }}
            onPress={onApplePress}
          />
          {error ? (
            <Text size="caption" color="destructive">
              {error}
            </Text>
          ) : null}
        </Stack>
      </Stack>
    </Screen>
  );
}
