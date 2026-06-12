import { ManifestRenderer, fetchManifest, tokenFromUrl } from '@sherizan/proto-renderer';
import type { Manifest } from '@sherizan/proto-manifest';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import demo from './manifests/demo.json';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; manifest: Manifest };

export default function ClipApp() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    (async () => {
      const token = tokenFromUrl(await Linking.getInitialURL());
      if (!token) {
        // Launched without an invocation link — show the bundled demo.
        setState({ status: 'ready', manifest: demo as unknown as Manifest });
        return;
      }
      const result = await fetchManifest(token);
      if (result.ok) {
        setState({ status: 'ready', manifest: result.manifest });
      } else {
        setState({ status: 'error', message: result.message });
      }
    })();
  }, []);

  if (state.status === 'ready') {
    return <ManifestRenderer manifest={state.manifest} />;
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {state.status === 'loading' ? (
        <ActivityIndicator />
      ) : (
        <Text style={{ fontSize: 16, textAlign: 'center', color: '#000' }}>{state.message}</Text>
      )}
    </View>
  );
}
