import { describe, expect, it } from 'vitest';
import { readOwnVersion, renderBanner } from './banner.js';

describe('renderBanner', () => {
  it('includes the ASCII art block (6 rows, mix of █ and ╚ chars)', () => {
    const out = renderBanner('0.1.4');
    expect(out).toContain('██████');
    const artRows = out.split('\n').filter((l) => /[█╚]/.test(l));
    expect(artRows.length).toBe(6);
  });

  it('includes the version line', () => {
    const out = renderBanner('0.1.4');
    expect(out).toContain('Prototo v0.1.4');
  });

  it('includes the tagline on its own line', () => {
    const out = renderBanner('0.1.4');
    expect(out).toContain('Describe a screen.');
    expect(out).toContain('iPhone');
  });

  it('has a blank line between art and the title block', () => {
    const out = renderBanner('0.1.4');
    expect(out).toMatch(/╚═════╝\s*\n\nPrototo v/);
  });
});

describe('readOwnVersion', () => {
  it('returns a non-empty semver-ish string', () => {
    const v = readOwnVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});
