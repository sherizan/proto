import { describe, it, expect } from 'vitest';
import {
  CLI_SUPPORTED_SDK_MAJOR,
  SHARE_PROJECT_ID,
  SHARE_SLUG,
  SHARE_UPDATES_URL,
  ensureShareConfig,
  shareRuntimeVersion,
  type ShareConfigFs,
} from './share-config.js';

const CURRENT = `prototo-${CLI_SUPPORTED_SDK_MAJOR}`;

function memFs(initial: Record<string, string>): ShareConfigFs & { files: Record<string, string> } {
  const files = { ...initial };
  return {
    files,
    existsSync: (p) => p in files,
    readFileSync: (p) => files[p],
    writeFileSync: (p, data) => {
      files[p] = data;
    },
  };
}

const CONFIG = '/proj/.proto/expo-config/app.json';

describe('ensureShareConfig', () => {
  it('injects the central project identity onto a bare prototype config', () => {
    const fs = memFs({
      [CONFIG]: JSON.stringify({ expo: { name: 'Ombak', slug: 'ombak', scheme: 'prototo' } }),
    });
    const wrote = ensureShareConfig('/proj', { fs });
    expect(wrote).toBe(true);
    const c = JSON.parse(fs.files[CONFIG]).expo;
    expect(c.slug).toBe(SHARE_SLUG);
    expect(c.extra.eas.projectId).toBe(SHARE_PROJECT_ID);
    expect(c.runtimeVersion).toBe(CURRENT);
    expect(c.updates.url).toBe(SHARE_UPDATES_URL);
    // unrelated fields preserved
    expect(c.name).toBe('Ombak');
    expect(c.scheme).toBe('prototo');
  });

  it('is idempotent — no write when already configured', () => {
    const fs = memFs({
      [CONFIG]: JSON.stringify({
        expo: {
          name: 'Ombak',
          slug: SHARE_SLUG,
          scheme: 'prototo',
          runtimeVersion: CURRENT,
          updates: { url: SHARE_UPDATES_URL },
          extra: { eas: { projectId: SHARE_PROJECT_ID } },
        },
      }),
    });
    const before = fs.files[CONFIG];
    const wrote = ensureShareConfig('/proj', { fs });
    expect(wrote).toBe(false);
    expect(fs.files[CONFIG]).toBe(before);
  });

  it("derives the runtime version from the project's installed expo, not the CLI", () => {
    const fs = memFs({ [CONFIG]: JSON.stringify({ expo: { name: 'Ombak', slug: 'ombak' } }) });
    ensureShareConfig('/proj', { fs, readSdkMajor: () => '56' });
    expect(JSON.parse(fs.files[CONFIG]).expo.runtimeVersion).toBe('prototo-56');
  });

  it('returns false (cannot set up) when the config file is missing', () => {
    const fs = memFs({});
    expect(ensureShareConfig('/proj', { fs })).toBe(false);
  });

  it('SHARE_UPDATES_URL derives from the project id', () => {
    expect(SHARE_UPDATES_URL).toBe(`https://u.expo.dev/${SHARE_PROJECT_ID}`);
  });
});

describe('shareRuntimeVersion', () => {
  it('is prototo-<project expo major>', () => {
    expect(shareRuntimeVersion('/proj', { readSdkMajor: () => '56' })).toBe('prototo-56');
    expect(shareRuntimeVersion('/proj', { readSdkMajor: () => '57' })).toBe('prototo-57');
  });

  it("falls back to the CLI's own SDK when the project's expo is unreadable", () => {
    expect(shareRuntimeVersion('/proj', { readSdkMajor: () => null })).toBe(CURRENT);
  });
});
