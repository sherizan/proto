import type { Action, Manifest } from '@sherizan/proto-manifest';
import { ProtoConfigProvider } from 'proto-components';
import { useReducer } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { renderNode } from './renderNode';
import { type Runtime, applyAction, currentScreen, initialRuntime } from './runtime';

// Renders a whole manifest: drives theme from manifest.app, holds the nav stack +
// state via the pure runtime reducer, and renders the current screen natively.
export function ManifestRenderer({ manifest }: { manifest: Manifest }) {
  const [runtime, dispatch] = useReducer(
    (rt: Runtime, action: Action) => applyAction(rt, action),
    manifest,
    initialRuntime,
  );

  const screen = manifest.screens[currentScreen(runtime)];

  return (
    <SafeAreaProvider>
      <ProtoConfigProvider config={manifest.app}>
        {screen ? renderNode(screen, { state: runtime.state, dispatch }) : null}
      </ProtoConfigProvider>
    </SafeAreaProvider>
  );
}
