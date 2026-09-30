import type { SchemeColor, Theme, ThemeOverrides } from './types';

// Pure (no react-native import) so it can be unit-tested in Node.
export function resolveColor(value: SchemeColor, isDark: boolean): string {
  return typeof value === 'string' ? value : isDark ? value.dark : value.light;
}

function resolveColors<K extends string>(
  colors: Partial<Record<K, SchemeColor>> | undefined,
  isDark: boolean,
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const key in colors) {
    const value = colors[key];
    if (value !== undefined) out[key] = resolveColor(value, isDark);
  }
  return out;
}

export function mergeTheme(base: Theme, overrides: ThemeOverrides | undefined, isDark: boolean): Theme {
  if (!overrides) return base;
  return {
    surface: { ...base.surface, ...resolveColors(overrides.surface, isDark) },
    text: { ...base.text, ...resolveColors(overrides.text, isDark) },
    blur: { ...base.blur, ...overrides.blur },
    border: { ...base.border, ...resolveColors(overrides.border, isDark) },
    radius: { ...base.radius, ...overrides.radius },
    space: { ...base.space, ...overrides.space },
  };
}
