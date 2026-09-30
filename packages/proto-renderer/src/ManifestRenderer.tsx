import type { Action, Manifest } from '@sherizan/proto-manifest';
import { ProtoConfigProvider } from 'proto-components';
import { useReducer } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScreenStack, ScreenStackItem } from 'react-native-screens';
import { renderNode } from './renderNode';
import { type Runtime, applyAction, initialRuntime } from './runtime';

// Renders a whole manifest as a native stack via react-native-screens — the same
// navigation primitive expo-router 56 is built on (SDK 56 dropped react-navigation).
// Real iOS nav bars with the manifest's screen titles and native push/pop + swipe-back.
// Inline titles only: on iOS 26, going back to a scrolled large-title screen freezes
// the app (rns 4.26 safe-area view vs UINavigationController, watchdog 0x8BADF00D).
export function ManifestRenderer({ manifest }: { manifest: Manifest }) {
  const [runtime, dispatch] = useReducer(
    (rt: Runtime, action: Action) => applyAction(rt, action),
    manifest,
    initialRuntime,
  );

  return (
    <SafeAreaProvider>
      <ProtoConfigProvider config={manifest.app}>
        <ScreenStack style={{ flex: 1 }}>
          {runtime.navStack.map((name, index) => {
            const screen = manifest.screens[name];
            const isRoot = index === 0;
            return (
              <ScreenStackItem
                key={`${name}-${index}`}
                screenId={`${name}-${index}`}
                stackAnimation={isRoot ? 'none' : 'default'}
                // Native back-swipe / back button pops our reducer stack in turn.
                onDismissed={isRoot ? undefined : () => dispatch({ action: 'dismiss' })}
                headerConfig={{
                  title: screen?.title ?? name,
                  hidden: false,
                }}
                style={{ flex: 1 }}
              >
                {screen ? renderNode(screen, { state: runtime.state, dispatch }) : null}
              </ScreenStackItem>
            );
          })}
        </ScreenStack>
      </ProtoConfigProvider>
    </SafeAreaProvider>
  );
}
