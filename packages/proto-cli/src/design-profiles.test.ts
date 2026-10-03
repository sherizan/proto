import { describe, expect, it } from 'vitest';
import { applyProfile, listProfiles, resolveDesign, validateOverrides } from './design/profiles.js';
import { updateDesignSection } from './design/document.js';

describe('shared design profiles', () => {
  it('lists four independent versioned directions and the preferred references', () => {
    const profiles = listProfiles();
    expect(profiles.map(p => p.id)).toEqual(['warm', 'utility', 'editorial', 'expressive']);
    expect(profiles.every(p => p.version === '1.0.0')).toBe(true);
    profiles[0].references.push('mutated');
    expect(listProfiles()[0].references).not.toContain('mutated');
    expect(profiles.flatMap(p => p.references)).toContain('Perplexity');
  });

  it('resolves light/dark colour pairs and role overrides from actual config', () => {
    const config = applyProfile({}, { id: 'warm', version: '1.0.0' }, {
      accentColor: { light: '#123456', dark: '#ABCDEF' },
      tokens: { typography: { title: { fontSize: 31 } }, space: { md: 18 } },
    });
    expect(resolveDesign(config, false).accent).toBe('#123456');
    expect(resolveDesign(config, true).accent).toBe('#ABCDEF');
    expect(resolveDesign(config, false).theme.typography.title.fontSize).toBe(31);
    expect(resolveDesign(config, true).theme.space.md).toBe(18);
  });

  it('preserves existing branding and unrelated project fields on adoption', () => {
    const result = applyProfile({ name: 'Brand', theme: 'base', accentColor: '#007AFF', screens: { initial: 'Shop' }, tokens: { space: { md: 16 } } }, { id: 'warm', version: '1.0.0' });
    expect(result.name).toBe('Brand');
    expect(result.theme).toBe('base');
    expect(result.accentColor).toBe('#007AFF');
    expect(result.screens).toEqual({ initial: 'Shop' });
    expect(result.designProfile.overrides.tokens?.space?.md).toBe(16);
  });

  it('switches profile defaults while retaining explicit overrides and subsequent direct edits', () => {
    const warm = applyProfile({}, { id: 'warm', version: '1.0.0' }, { tokens: { space: { md: 16 } } });
    warm.tokens.space.lg = 28;
    const next = applyProfile(warm, { id: 'editorial', version: '1.0.0' });
    expect(next.tokens.space.md).toBe(16);
    expect(next.tokens.space.lg).toBe(28);
    expect(next.tokens.radius.card).not.toBe(warm.tokens.radius.card);
    expect(next.designProfile.overrides.tokens?.space?.md).toBe(16);
  });

  it('allows an explicitly requested reset, without altering the input', () => {
    const original = { name: 'Brand', accentColor: '#123456' };
    const result = applyProfile(original, { id: 'utility', version: '1.0.0' }, {}, false);
    expect(result.accentColor).not.toBe('#123456');
    expect(original).toEqual({ name: 'Brand', accentColor: '#123456' });
  });

  it('rejects unavailable versions rather than silently choosing the latest', () => {
    expect(() => applyProfile({}, { id: 'warm', version: '2.0.0' })).toThrow(/version/i);
    expect(() => applyProfile({}, { id: 'unknown', version: '1.0.0' })).toThrow(/profile/i);
  });

  it.each([
    { tokens: { typo: {} } }, { tokens: { space: { md: -1 } } },
    { tokens: { typography: { body: { fontSize: 2 } } } },
    { tokens: { typography: { title: { fontWeight: 'boldish' } } } },
    { accentColor: { light: '#fff' } }, { accentColor: 'not-a-colour' },
    { tokens: { radius: { card: Infinity } } }, { name: 'unowned' },
    JSON.parse('{"__proto__":{"polluted":true}}'),
  ])('rejects malformed or unsupported overrides: %j', input => {
    expect(() => validateOverrides(input)).toThrow();
  });

  it('does not need the catalog to render materialized saved values', () => {
    const config = applyProfile({}, { id: 'warm', version: '1.0.0' });
    config.designProfile.version = 'future-version';
    expect(resolveDesign(config, false).theme.space).toEqual(config.tokens.space);
  });
});

describe('managed design documentation', () => {
  it('renders both schemes and typography from resolved values, preserving surrounding notes byte for byte', () => {
    const config = applyProfile({}, { id: 'warm', version: '1.0.0' }, { accentColor: { light: '#123456', dark: '#ABCDEF' }, tokens: { typography: { title: { fontSize: 31 } } } });
    const first = updateDesignSection('# My direction\n\nKeep the photography.\n', config);
    const withNotes = first + '\n## Decisions\nKeep prices unchanged.\n';
    const next = updateDesignSection(withNotes, { ...config, accentColor: '#654321' });
    expect(next.startsWith('# My direction\n\nKeep the photography.\n')).toBe(true);
    expect(next.endsWith('\n## Decisions\nKeep prices unchanged.\n')).toBe(true);
    expect(first).toContain('#123456');
    expect(first).toContain('#ABCDEF');
    expect(first).toContain('31px');
    expect(next).not.toContain('#123456');
    expect(updateDesignSection(next, { ...config, accentColor: '#654321' })).toBe(next);
  });

  it.each(['<!-- prototo-tokens:start -->', '<!-- prototo-tokens:end -->', '<!-- prototo-tokens:end --><!-- prototo-tokens:start -->', '<!-- prototo-tokens:start --><!-- prototo-tokens:start --><!-- prototo-tokens:end -->'])('refuses damaged blocks without discarding notes', doc => {
    expect(() => updateDesignSection(doc, {})).toThrow(/managed/i);
  });
});
