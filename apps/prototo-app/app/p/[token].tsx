import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GlassView } from 'expo-glass-effect';
import { lookupShare, ShareLookupError, type ShareLookupResponse } from '../../lib/share-lookup';
import { redirectToDevClient } from '../../lib/viewer-redirect';

type State =
  | { kind: 'loading'; designerName: string | null }
  | { kind: 'error-expired' }
  | { kind: 'error-unreachable' };

export default function ViewerRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: 'loading', designerName: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const safeToken = typeof token === 'string' ? token : '';

    (async () => {
      let share: ShareLookupResponse;
      try {
        share = await lookupShare(safeToken);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ShareLookupError && err.kind === 'expired') {
          setState({ kind: 'error-expired' });
        } else {
          setState({ kind: 'error-unreachable' });
        }
        return;
      }
      if (cancelled) return;
      setState({ kind: 'loading', designerName: share.designerName });
      try {
        await redirectToDevClient(share.tunnelUrl);
        // After Linking.openURL fires, expo-dev-client takes over and
        // the JS context will be replaced. Render state below doesn't matter.
      } catch {
        if (!cancelled) setState({ kind: 'error-unreachable' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  return (
    <View style={styles.container}>
      <View style={styles.bg} />
      <GlassView style={styles.glass} glassEffectStyle="clear">
        {state.kind === 'loading' && (
          <Text style={styles.title}>
            {state.designerName ? `Loading ${state.designerName}'s prototype…` : 'Loading prototype…'}
          </Text>
        )}
        {state.kind === 'error-expired' && (
          <>
            <Text style={styles.title}>This share link expired.</Text>
            <Text style={styles.body}>Ask the designer for a new one.</Text>
            <Pressable
              style={styles.button}
              onPress={() => setAttempt((n) => n + 1)}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        )}
        {state.kind === 'error-unreachable' && (
          <>
            <Text style={styles.title}>Can't reach the designer's Mac.</Text>
            <Text style={styles.body}>They may have stopped sharing.</Text>
            <Pressable
              style={styles.button}
              onPress={() => setAttempt((n) => n + 1)}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        )}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1a1a1a' },
  glass: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '40%',
    padding: 28,
    borderRadius: 28,
    overflow: 'hidden',
  },
  title: { fontSize: 22, fontWeight: '600', color: '#FFFFFF' },
  body: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
  },
  buttonText: { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
});
