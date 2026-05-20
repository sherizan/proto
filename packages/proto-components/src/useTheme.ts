import config from '../../proto.config.js';
import { liquidGlass } from './tokens/liquidGlass';
import { materialYou } from './tokens/materialYou';
import type { ProtoConfig, Theme, ThemeName, ThemeOverrides } from './types';

const themes: Record<ThemeName, Theme> = {
  liquidGlass,
  materialYou,
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

const cfg = config as ProtoConfig;

export function useTheme(): Theme {
  const name: ThemeName = cfg.theme ?? 'liquidGlass';
  const base = themes[name] ?? themes.liquidGlass;
  return mergeTheme(base, cfg.tokens);
}

export function useAccent(): string {
  return cfg.accentColor ?? '#007AFF';
}
