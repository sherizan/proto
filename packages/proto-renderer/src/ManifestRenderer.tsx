import type { Action, Manifest } from '@sherizan/proto-manifest';
import { ProtoConfigProvider } from 'proto-components';
import { useReducer } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScreenStack, ScreenStackItem } from 'react-native-screens';
import { renderNode } from './renderNode';
import { type Runtime, applyAction, initialRuntime } from './runtime';

// Renders a whole manifest as a native stack via react-native-screens — the same
// navigation primitive expo-router 56 is built on (SDK 56 dropped react-navigation).
// Real iOS nav bars with the manifest's screen titles, native push/pop + swipe-back,
// and a large title on the entry screen that collapses to a centered inline title on
// scroll (the documented combo: a translucent header + the Screen's ScrollView with
// contentInsetAdjustmentBehavior="automatic").
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
                  // Large title (collapses to inline on scroll) on the entry screen;
                  // pushed screens get the inline title + native back button.
                  largeTitle: isRoot,
                  // Translucent header lets the scroll view track the bar so the
                  // large title collapses instead of scrolling away.
                  translucent: isRoot,
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
