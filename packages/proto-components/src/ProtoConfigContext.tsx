import { type ReactNode, createContext, useContext, useEffect } from 'react';
import { Appearance } from 'react-native';
import defaultConfigModule from '../../proto.config.js';
import type { ProtoConfig } from './types';

// The static `proto.config.js` at the project root is the default. Scaffolded
// projects render screens directly (no provider) and fall back to it, so their
// behaviour is unchanged. The manifest renderer wraps its tree in
// <ProtoConfigProvider config={manifest.app}> to drive theme from a manifest.
const defaultConfig = defaultConfigModule as ProtoConfig;

// A pinned `colorScheme` has to reach native views too: SwiftUI Hosts, sheets and
// the nav bar read the window's trait collection, not useTheme(). Appearance sets
// overrideUserInterfaceStyle on every window; 'system' clears it. The Viewer shell
// clears it again on Exit, so a prototype's pin never leaks into Home.
function applyColorScheme(scheme: ProtoConfig['colorScheme']) {
  Appearance.setColorScheme(scheme === 'light' || scheme === 'dark' ? scheme : 'unspecified');
}
applyColorScheme(defaultConfig.colorScheme);

const ProtoConfigContext = createContext<ProtoConfig | null>(null);

export function ProtoConfigProvider({
  config,
  children,
}: {
  config?: ProtoConfig;
  children: ReactNode;
}) {
  const scheme = (config ?? defaultConfig).colorScheme;
  useEffect(() => {
    applyColorScheme(scheme);
    return () => applyColorScheme(defaultConfig.colorScheme);
  }, [scheme]);

  return (
    <ProtoConfigContext.Provider value={config ?? defaultConfig}>
      {children}
    </ProtoConfigContext.Provider>
  );
}

export function useProtoConfig(): ProtoConfig {
  return useContext(ProtoConfigContext) ?? defaultConfig;
}
