import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Button, Divider, Input, Lottie, Row, Screen, Stack, Text, useTheme } from 'proto-components';
import { GoogleIcon } from './GoogleIcon';
import { appleSignInErrorMessage } from '../lib/apple-auth';
import { authErrorMessage } from '../lib/auth-errors';
import { useAuth } from '../lib/auth-context';

export function SignInScreen() {
  const { signInWithApple, signInWithGoogle, sendEmailCode, verifyEmailCode } = useAuth();
  const theme = useTheme();
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onApple() {
    if (pending) return;
    setError('');
    setPending(true);
    try {
      await signInWithApple();
    } catch (e) {
      setError(appleSignInErrorMessage((e as { code?: string })?.code));
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    if (pending) return;
    setError('');
    setPending(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  async function onSendCode() {
    if (pending || cooldown > 0) return;
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setPending(true);
    try {
      await sendEmailCode(trimmed);
      setStep('code');
      setCooldown(60);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  async function onVerify() {
    if (pending) return;
    if (code.trim().length !== 6) { setError('Enter the 6-digit code.'); return; }
    setError('');
    setPending(true);
    try {
      await verifyEmailCode(email.trim(), code.trim());
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  function onChangeEmail() {
    setStep('idle');
    setCode('');
    setError('');
  }

  return (
    <Screen scrollable={false}>
      <Stack gap={12} padding={12}>
        <Lottie
          source={require('../assets/logo-prototo.json')}
          style={{ width: 44, height: 44 }}
        />
        <Text size="title">Prototo</Text>
        <Text size="body" color="secondary">
          View native prototypes shared with you.
        </Text>
      </Stack>

      <Stack style={{ flex: 1 }} />

      <Stack gap={16} padding={12}>
        {step === 'idle' ? (
          <Stack gap={12}>
            <Button
              label="Continue with Google"
              variant="secondary"
              icon={<GoogleIcon />}
              style={{ backgroundColor: theme.surface.card, height: 52 }}
              onPress={onGoogle}
              disabled={pending}
            />
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={theme.radius.button}
              style={{ height: 52 }}
              onPress={onApple}
            />
            <Divider label="or" />
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@studio.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!pending}
              onSubmitEditing={onSendCode}
            />
            <Button
              label="Continue with email"
              variant="secondary"
              style={{ backgroundColor: theme.surface.card, height: 52 }}
              onPress={onSendCode}
              disabled={pending || cooldown > 0}
            />
          </Stack>
        ) : (
          <Stack gap={16}>
            <Text size="body" color="secondary">
              Enter the code sent to {email.trim()}
            </Text>
            <Input
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
              editable={!pending}
              onSubmitEditing={onVerify}
              style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
            />
            <Button label="Verify" variant="primary" style={{ height: 52 }} onPress={onVerify} disabled={pending} />
            <Row gap={16}>
              <Button
                label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                variant="ghost"
                onPress={onSendCode}
                disabled={pending || cooldown > 0}
              />
              <Button label="Change email" variant="ghost" onPress={onChangeEmail} disabled={pending} />
            </Row>
          </Stack>
        )}

        {error ? (
          <Text size="caption" color="destructive">
            {error}
          </Text>
        ) : null}
      </Stack>
    </Screen>
  );
}
