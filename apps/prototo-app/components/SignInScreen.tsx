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
      <Stack gap={24} padding={24}>
        <Text size="title">Prototo</Text>
        <Text size="body" color="secondary">
          Sign in to open prototypes and share your own.
        </Text>
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
    </Screen>
  );
}
