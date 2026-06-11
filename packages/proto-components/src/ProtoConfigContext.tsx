import { type ReactNode, createContext, useContext } from 'react';
import defaultConfigModule from '../../proto.config.js';
import type { ProtoConfig } from './types';

// The static `proto.config.js` at the project root is the default. Scaffolded
// projects render screens directly (no provider) and fall back to it, so their
// behaviour is unchanged. The manifest renderer wraps its tree in
// <ProtoConfigProvider config={manifest.app}> to drive theme from a manifest.
const defaultConfig = defaultConfigModule as ProtoConfig;

const ProtoConfigContext = createContext<ProtoConfig | null>(null);

export function ProtoConfigProvider({
  config,
  children,
}: {
  config?: ProtoConfig;
  children: ReactNode;
}) {
  return (
    <ProtoConfigContext.Provider value={config ?? defaultConfig}>
      {children}
    </ProtoConfigContext.Provider>
  );
}

export function useProtoConfig(): ProtoConfig {
  return useContext(ProtoConfigContext) ?? defaultConfig;
}
