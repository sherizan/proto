import { describe, expect, it } from 'vitest';
import { mergeTheme, resolveColor } from './mergeTheme';
import { base } from './tokens/base';

describe('light/dark config colours', () => {
  it('resolves a pair by scheme and passes a single value through', () => {
    expect(resolveColor({ light: '#009580', dark: '#00CBAE' }, false)).toBe('#009580');
    expect(resolveColor({ light: '#009580', dark: '#00CBAE' }, true)).toBe('#00CBAE');
    expect(resolveColor('#007AFF', true)).toBe('#007AFF');
  });

  it('merges pairs into the theme for the active scheme only', () => {
    const tokens = {
      surface: { primary: { light: '#FFFFFF', dark: '#111927' } },
      text: { primary: '#252A31' },
      radius: { card: 6 },
    };
    const dark = mergeTheme(base, tokens, true);
    expect(dark.surface.primary).toBe('#111927');
    expect(dark.text.primary).toBe('#252A31');
    expect(dark.radius.card).toBe(6);
    expect(dark.surface.secondary).toBe(base.surface.secondary);
    expect(mergeTheme(base, tokens, false).surface.primary).toBe('#FFFFFF');
  });
});
