import { expect, it } from 'vitest';
import { accentForeground } from './design/contrast.js';
import { listProfiles, applyProfile, resolveDesign } from './design/profiles.js';
it('selects readable foregrounds for dark and light accents', () => {
  expect(accentForeground('#F7AA89')).toBe('#000000');
  expect(accentForeground('#9D4328')).toBe('#FFFFFF');
  expect(accentForeground('#fff')).toBe('#000000');
  expect(accentForeground('rgba(0,0,0,0.1)')).toBeUndefined();
});
it('every built-in profile resolves to a supported contrast choice in both schemes', () => {
  for (const profile of listProfiles()) for (const dark of [false, true]) {
    const {accent} = resolveDesign(applyProfile({}, profile), dark);
    expect(accentForeground(accent)).toMatch(/^#(000000|FFFFFF)$/);
  }
});
