import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ManifestRenderer } from '@sherizan/proto-renderer';
import type { Manifest } from '@sherizan/proto-manifest';
import { fetchManifest } from '../../lib/fetch-manifest';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; manifest: Manifest };

export default function ViewerRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const safeToken = typeof token === 'string' ? token : '';

    (async () => {
      const result = await fetchManifest(safeToken);
      if (cancelled) return;
      if (result.ok) {
        setState({ status: 'ready', manifest: result.manifest });
      } else {
        setState({ status: 'error', message: result.message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === 'ready') {
    return <ManifestRenderer manifest={state.manifest} />;
  }
  return (
    <View style={styles.container}>
      {state.status === 'loading' ? (
        <ActivityIndicator />
      ) : (
        <Text style={styles.message}>{state.message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontSize: 16, textAlign: 'center', color: '#000' },
});
