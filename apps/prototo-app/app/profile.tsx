import { Stack as ExpoStack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { Button, Card, Divider, Modal, Screen, Stack, Text } from 'proto-components';
import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { deleteAccount } from '../lib/account';

export default function Profile() {
  const { session, signOut } = useAuth();
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

  return (
    <Screen>
      <ExpoStack.Screen options={{ headerShown: true, title: 'Profile' }} />
      <Card padding={0}>
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
