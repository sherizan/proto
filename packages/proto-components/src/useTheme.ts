import { useColorScheme } from 'react-native';
import { useProtoConfig } from './ProtoConfigContext';
import { base, baseDark } from './tokens/base';
import { liquidGlass, liquidGlassDark } from './tokens/liquidGlass';
import { materialYou, materialYouDark } from './tokens/materialYou';
import { mergeTheme, resolveColor } from './mergeTheme';
import type { Theme, ThemeName } from './types';

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

// A hook — it reads the system colour scheme so screens re-render when the device
// switches between light and dark. Config comes from the nearest
// <ProtoConfigProvider> or, with no provider, the project's static `proto.config.js`.
// `colorScheme: 'light' | 'dark'` pins it; the default ('system') follows the device.
function useIsDark(): boolean {
  const preference = useProtoConfig().colorScheme ?? 'system';
  const systemScheme = useColorScheme();
  return preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
}

// Colour tokens and the accent take one value or a `{ light, dark }` pair.
export function useTheme(): Theme {
  const cfg = useProtoConfig();
  const isDark = useIsDark();
  const name: ThemeName = cfg.theme ?? 'liquidGlass';
  const set = isDark ? darkThemes : lightThemes;
  const base = set[name] ?? set.liquidGlass;
  return mergeTheme(base, cfg.tokens, isDark);
}

export function useAccent(): string {
  const accent = useProtoConfig().accentColor ?? '#007AFF';
  return resolveColor(accent, useIsDark());
}
