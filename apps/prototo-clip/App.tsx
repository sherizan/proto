import type { Manifest } from '@sherizan/proto-manifest';
import { ManifestRenderer } from '@sherizan/proto-renderer';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import demo from './manifests/demo.json';

// Override at build time for staging/local validation; defaults to production.
const API_BASE = process.env.EXPO_PUBLIC_SHARE_API_BASE ?? 'https://prototo.app';

// An App Clip is invoked with its URL (https://prototo.app/p/<token>). Pull the
// 5-char Crockford token out of the path.
function tokenFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/p\/([0-9A-HJ-NP-TV-Z]{5})(?:[/?#]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; manifest: Manifest };

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    (async () => {
      const token = tokenFromUrl(await Linking.getInitialURL());
      if (!token) {
        // Launched without an invocation link — show the bundled demo.
        setState({ status: 'ready', manifest: demo as unknown as Manifest });
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/share/${token}`);
        if (res.status === 404) {
          setState({ status: 'error', message: "This prototype link isn't active anymore." });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', message: "Couldn't load this prototype." });
          return;
        }
        const body = (await res.json()) as { manifest: Manifest };
        setState({ status: 'ready', manifest: body.manifest });
      } catch {
        setState({ status: 'error', message: "Couldn't reach Prototo. Check your connection." });
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
