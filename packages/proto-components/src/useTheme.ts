import { useColorScheme } from 'react-native';
import { useProtoConfig } from './ProtoConfigContext';
import { base, baseDark } from './tokens/base';
import { liquidGlass, liquidGlassDark } from './tokens/liquidGlass';
import { materialYou, materialYouDark } from './tokens/materialYou';
import type { Theme, ThemeName, ThemeOverrides } from './types';

const lightThemes: Record<ThemeName, Theme> = {
  liquidGlass,
  materialYou,
  base,
};

const darkThemes: Record<ThemeName, Theme> = {
  liquidGlass: liquidGlassDark,
  materialYou: materialYouDark,
  base: baseDark,
};

function mergeTheme(base: Theme, overrides?: ThemeOverrides): Theme {
  if (!overrides) return base;
  return {
    surface: { ...base.surface, ...overrides.surface },
    text: { ...base.text, ...overrides.text },
    blur: { ...base.blur, ...overrides.blur },
    border: { ...base.border, ...overrides.border },
    radius: { ...base.radius, ...overrides.radius },
    space: { ...base.space, ...overrides.space },
  };
}

// A hook — it reads the system colour scheme so screens re-render when the device
// switches between light and dark. Call it during render, like any hook.
// Config comes from the nearest <ProtoConfigProvider> (the manifest renderer sets
// one) or, with no provider, the project's static `proto.config.js`. A scheme can
// be pinned with `colorScheme: 'light' | 'dark'`; the default ('system') follows
// the device.
export function useTheme(): Theme {
  const cfg = useProtoConfig();
  const systemScheme = useColorScheme();
  const preference = cfg.colorScheme ?? 'system';
  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');

  const name: ThemeName = cfg.theme ?? 'liquidGlass';
  const set = isDark ? darkThemes : lightThemes;
  const base = set[name] ?? set.liquidGlass;
  return mergeTheme(base, cfg.tokens);
}

export function useAccent(): string {
  return useProtoConfig().accentColor ?? '#007AFF';
}
