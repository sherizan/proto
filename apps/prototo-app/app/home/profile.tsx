import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Card, Divider, Screen, Stack, Text } from 'proto-components';
import { Fragment, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { deleteAccount } from '../../lib/account';
import { PlusCard } from '../../components/PlusCard';
import type { PlusStatus } from '../../lib/plus';

const LINKS = [
  { label: 'Privacy Policy', url: 'https://prototo.app/privacy' },
  { label: 'Terms', url: 'https://prototo.app/terms' },
  { label: 'Documentation', url: 'https://docs.prototo.app' },
];

export default function Profile() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [plus, setPlus] = useState<PlusStatus | null>(null);

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

  // The Plus purchase card carries its own Terms of Use + Privacy Policy (App Review wants
  // them beside the price), so the links card repeats only Documentation while it shows.
  const purchaseCardShown = plus != null && !plus.plus;
  const links = purchaseCardShown ? LINKS.filter((l) => l.label === 'Documentation') : LINKS;
  const name = (session?.user.user_metadata?.full_name as string | undefined) ?? session?.user.email ?? '';
  const email = session?.user.email ?? '';

  return (
    <Screen>
      <Stack gap={24}>
        <Text size="title">Account</Text>

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
        </Card>

        <PlusCard onStatus={setPlus} />

        <Card padding={0}>
          {links.map((l, i) => (
            <Fragment key={l.url}>
              {i > 0 ? <Divider /> : null}
              <Pressable onPress={() => WebBrowser.openBrowserAsync(l.url)} style={{ padding: 16 }}>
                <Text size="body">{l.label}</Text>
              </Pressable>
            </Fragment>
          ))}
        </Card>

        <Text size="caption" color="secondary" style={{ textAlign: 'center' }}>
          {/* Info.plist version — Constants.expoConfig came from the embedded
              update manifest and showed 0.0.0 in App Store builds. */}
          Version {Application.nativeApplicationVersion ?? '1.0'}
        </Text>

        <Stack gap={4} align="center" style={{ paddingTop: 24 }}>
          <Pressable onPress={() => !deleting && setConfirmDelete(true)} style={{ padding: 12 }}>
            <Text size="body" color="destructive">
              {deleting ? 'Deleting…' : 'Delete account'}
            </Text>
          </Pressable>
          {deleteError ? (
            <Text size="caption" color="destructive">
              {deleteError}
            </Text>
          ) : null}
        </Stack>
      </Stack>

      <Alert
        title="Delete account?"
        message={
          plus?.via === 'apple'
            ? "This permanently deletes your account and everything you've shared. It can't be undone. Your Plus subscription keeps renewing until you cancel it in your App Store settings."
            : "This permanently deletes your account and everything you've shared. It can't be undone."
        }
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        actions={[
          { label: 'Cancel', cancel: true },
          { label: 'Delete', destructive: true, onPress: () => void onDeleteAccount() },
        ]}
      />
    </Screen>
  );
}
