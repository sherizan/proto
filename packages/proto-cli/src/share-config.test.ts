import { describe, it, expect } from 'vitest';
import {
  SHARE_PROJECT_ID,
  SHARE_SLUG,
  SHARE_RUNTIME_VERSION,
  SHARE_UPDATES_URL,
  ensureShareConfig,
  type ShareConfigFs,
} from './share-config.js';

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
    const fs = memFs({ [CONFIG]: JSON.stringify({ expo: { name: 'Ombak', slug: 'ombak', scheme: 'prototo' } }) });
    const wrote = ensureShareConfig('/proj', { fs });
    expect(wrote).toBe(true);
    const c = JSON.parse(fs.files[CONFIG]).expo;
    expect(c.slug).toBe(SHARE_SLUG);
    expect(c.extra.eas.projectId).toBe(SHARE_PROJECT_ID);
    expect(c.runtimeVersion).toBe(SHARE_RUNTIME_VERSION);
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
          runtimeVersion: SHARE_RUNTIME_VERSION,
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

  it('returns false (cannot set up) when the config file is missing', () => {
    const fs = memFs({});
    expect(ensureShareConfig('/proj', { fs })).toBe(false);
  });

  it('SHARE_UPDATES_URL derives from the project id', () => {
    expect(SHARE_UPDATES_URL).toBe(`https://u.expo.dev/${SHARE_PROJECT_ID}`);
  });
});
