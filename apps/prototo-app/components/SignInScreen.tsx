import { useState } from 'react';
import { Button, Divider, Input, Lottie, Row, Screen, Stack, Text } from 'proto-components';
import { appleSignInErrorMessage } from '../lib/apple-auth';
import { authErrorMessage } from '../lib/auth-errors';
import { useAuth } from '../lib/auth-context';

export function SignInScreen() {
  const { signInWithApple, signInWithGoogle, sendEmailCode, verifyEmailCode } = useAuth();
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

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
    if (pending) return;
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
          style={{ width: 88, height: 88 }}
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
            <Button label="Continue with Google" variant="secondary" onPress={onGoogle} disabled={pending} />
            <Button label={'  Sign in with Apple'} variant="secondary" onPress={onApple} disabled={pending} />
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
            <Button label="Continue with email" variant="secondary" onPress={onSendCode} disabled={pending} />
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
            <Button label="Verify" variant="primary" onPress={onVerify} disabled={pending} />
            <Row gap={16}>
              <Button label="Resend" variant="ghost" onPress={onSendCode} disabled={pending} />
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
