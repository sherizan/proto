import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readProjectMetadata, mapTheme } from './project-metadata.js';

function makeProject(opts: {
  name?: string;
  theme?: string;
  screens?: string[];
  withoutConfig?: boolean;
  withoutScreensDir?: boolean;
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-share-meta-'));
  if (!opts.withoutConfig) {
    fs.writeFileSync(
      path.join(dir, 'proto.config.js'),
      `module.exports = ${JSON.stringify({
        name: opts.name ?? 'Atlas',
        theme: opts.theme ?? 'liquidGlass',
      })};`,
    );
  }
  if (!opts.withoutScreensDir) {
    fs.mkdirSync(path.join(dir, 'screens'));
    for (const s of opts.screens ?? ['Home.tsx', 'Settings.tsx']) {
      fs.writeFileSync(path.join(dir, 'screens', s), '');
    }
  }
  return dir;
}

describe('mapTheme', () => {
  it('liquidGlass -> liquid-glass', () => {
    expect(mapTheme('liquidGlass')).toBe('liquid-glass');
  });
  it('materialYou -> material-you', () => {
    expect(mapTheme('materialYou')).toBe('material-you');
  });
  it('passes through already-kebab values', () => {
    expect(mapTheme('liquid-glass')).toBe('liquid-glass');
    expect(mapTheme('material-you')).toBe('material-you');
  });
  it('falls back to liquid-glass on unknown', () => {
    expect(mapTheme('something-weird')).toBe('liquid-glass');
  });
});

describe('readProjectMetadata', () => {
  let dir: string;
  afterEach(() => {
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads name + theme from proto.config.js and counts .tsx in /screens', () => {
    dir = makeProject({ name: 'Atlas', theme: 'liquidGlass', screens: ['Home.tsx', 'Settings.tsx', 'About.tsx'] });
    const meta = readProjectMetadata(dir);
    expect(meta).toEqual({ appName: 'Atlas', screenCount: 3, theme: 'liquid-glass' });
  });

  it('ignores non-tsx files in /screens', () => {
    dir = makeProject({ screens: ['Home.tsx', 'README.md', 'thumbnail.png', 'Settings.tsx'] });
    const meta = readProjectMetadata(dir);
    expect(meta.screenCount).toBe(2);
  });

  it('returns screenCount=0 when /screens is empty', () => {
    dir = makeProject({ screens: [] });
    expect(readProjectMetadata(dir).screenCount).toBe(0);
  });

  it('returns screenCount=0 when /screens is missing', () => {
    dir = makeProject({ withoutScreensDir: true });
    expect(readProjectMetadata(dir).screenCount).toBe(0);
  });

  it('throws when proto.config.js is missing', () => {
    dir = makeProject({ withoutConfig: true });
    expect(() => readProjectMetadata(dir)).toThrow();
  });

  it('maps theme: materialYou -> material-you', () => {
    dir = makeProject({ theme: 'materialYou' });
    expect(readProjectMetadata(dir).theme).toBe('material-you');
  });

  it('falls back to liquid-glass when theme is unset', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-share-meta-'));
    fs.writeFileSync(path.join(d, 'proto.config.js'), `module.exports = { name: 'X' };`);
    fs.mkdirSync(path.join(d, 'screens'));
    dir = d;
    expect(readProjectMetadata(d).theme).toBe('liquid-glass');
  });
});
