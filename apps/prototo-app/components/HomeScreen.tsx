import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Button, Card, Divider, Modal, Screen, Stack, Text } from 'proto-components';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { deleteAccount } from '../lib/account';
import { loadPrototype } from '../lib/native-runtime';
import { fetchMyShares, type MyShare } from '../lib/my-shares';
import { parseShareLink } from '../lib/share-link';
import { relativeTime } from '../lib/relative-time';
import { SAMPLE } from '../lib/sample';

export function HomeScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [linkError, setLinkError] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [shares, setShares] = useState<MyShare[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const name =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    session?.user.email ??
    'there';

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    setStatus('loading');
    fetchMyShares(token).then((res) => {
      if (cancelled) return;
      setShares(res.ok ? res.shares : []);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

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

  async function onDeleteAccount() {
    const token = session?.access_token;
    if (!token || deleting) return;
    setDeleting(true);
    setDeleteError('');
    const result = await deleteAccount(token);
    if (result.ok) {
      await signOut();
      return;
    }
    setDeleting(false);
    setDeleteError('Could not delete your account. Please try again.');
  }

  return (
    <Screen>
      <Stack gap={24} padding={24}>
        <Stack gap={4}>
          <Text size="title">Hi {name}</Text>
          <Text size="body" color="secondary">
            View prototypes shared with you, or try the sample.
          </Text>
        </Stack>

        <Stack gap={8}>
          <Text size="label" color="secondary">
            Your prototypes
          </Text>
          {status === 'loading' ? (
            <Text size="body" color="secondary">
              Loading…
            </Text>
          ) : shares.length === 0 ? (
            <Card>
              <Text size="body" color="secondary">
                Prototypes you share will show up here.
              </Text>
            </Card>
          ) : (
            shares.map((s) => {
              const expired = new Date(s.expiresAt).getTime() < Date.now();
              return (
                <Card key={s.token}>
                  <Stack gap={8}>
                    <Text size="headline">{s.appName}</Text>
                    <Text size="caption" color="secondary">
                      {expired ? `Expired · shared ${relativeTime(s.createdAt)}` : `Shared ${relativeTime(s.createdAt)}`}
                    </Text>
                    <Button label="Open" variant="secondary" onPress={() => router.push(`/p/${s.token}`)} />
                  </Stack>
                </Card>
              );
            })
          )}
        </Stack>

        <Card>
          <Stack gap={12}>
            <Text size="headline">Try the sample</Text>
            <Text size="body" color="secondary">
              Open a sample prototype to see how Prototo looks.
            </Text>
            <Button label="Open sample" variant="primary" onPress={() => loadPrototype(SAMPLE.deepLink)} />
          </Stack>
        </Card>

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

        <Divider />
        <Button label="Sign out" variant="ghost" onPress={signOut} />
        <Button label="Delete account" variant="ghost" onPress={() => setConfirmDelete(true)} />
      </Stack>

      <Modal title="Delete account" visible={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)}>
        <Text size="body" color="secondary">
          This permanently deletes your account and everything you've shared. This can't be undone.
        </Text>
        {deleteError ? (
          <Text size="caption" color="destructive">
            {deleteError}
          </Text>
        ) : null}
        <Button
          label={deleting ? 'Deleting…' : 'Delete account'}
          variant="destructive"
          disabled={deleting}
          onPress={onDeleteAccount}
        />
        <Button label="Cancel" variant="ghost" disabled={deleting} onPress={() => setConfirmDelete(false)} />
      </Modal>
    </Screen>
  );
}
