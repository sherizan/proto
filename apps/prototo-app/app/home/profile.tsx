import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Button, Card, Divider, Modal, Row, Screen, Stack, Text, useTheme } from 'proto-components';
import { Fragment, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { deleteAccount } from '../../lib/account';
import { useTier } from '../../lib/use-tier';

const LINKS = [
  { label: 'Privacy Policy', url: 'https://prototo.app/privacy' },
  { label: 'Terms', url: 'https://prototo.app/terms' },
  { label: 'Documentation', url: 'https://docs.prototo.app' },
];

export default function Profile() {
  const { session, signOut } = useAuth();
  const theme = useTheme();
  const tier = useTier();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function leave() {
    await signOut();
    router.replace('/');
  }

  async function onDeleteAccount() {
    const token = session?.access_token;
    if (!token || deleting) return;
    setDeleting(true);
    setDeleteError('');
    const result = await deleteAccount(token);
    if (result.ok) {
      await leave();
      return;
    }
    setDeleting(false);
    setDeleteError('Could not delete your account. Please try again.');
  }

  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? session?.user.email ?? '';
  const email = session?.user.email ?? '';

  return (
    <Screen>
      <Stack gap={24}>
        <Row gap={8} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Text size="title">Account</Text>
          {tier === 'free' ? (
            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://prototo.app/pricing')}>
              <Text size="label" color="accent">
                Upgrade to Plus
              </Text>
            </Pressable>
          ) : tier === 'plus' ? (
            <View
              style={{
                backgroundColor: theme.surface.secondary,
                borderRadius: 999,
                paddingVertical: 2,
                paddingHorizontal: 8,
              }}
            >
              <Text size="label" color="accent">
                Plus
              </Text>
            </View>
          ) : null}
        </Row>

        <Card padding={0}>
          <Stack gap={4} style={{ padding: 16 }}>
            <Text size="headline">{name}</Text>
            {email && email !== name ? (
              <Text size="caption" color="secondary">
                {email}
              </Text>
            ) : null}
          </Stack>
          <Divider />
          <Pressable onPress={leave} style={{ padding: 16 }}>
            <Text size="body">Sign out</Text>
          </Pressable>
          <Divider />
          <Pressable onPress={() => setConfirmDelete(true)} style={{ padding: 16 }}>
            <Text size="body" color="destructive">
              Delete account
            </Text>
          </Pressable>
        </Card>

        <Card padding={0}>
          {LINKS.map((l, i) => (
            <Fragment key={l.url}>
              {i > 0 ? <Divider /> : null}
              <Pressable onPress={() => WebBrowser.openBrowserAsync(l.url)} style={{ padding: 16 }}>
                <Text size="body">{l.label}</Text>
              </Pressable>
            </Fragment>
          ))}
        </Card>

        <Text size="caption" color="secondary" style={{ textAlign: 'center' }}>
          Version {Constants.expoConfig?.version}
        </Text>
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
