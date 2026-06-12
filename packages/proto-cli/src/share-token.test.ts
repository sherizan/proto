import { describe, it, expect } from 'vitest';
import { generateToken, getOrCreateToken, type ShareTokenFs } from './share-token.js';

const CROCKFORD = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{5}$/;

describe('generateToken', () => {
  it('returns a 5-char Crockford token (no I/L/O/U)', () => {
    for (let i = 0; i < 200; i++) expect(generateToken()).toMatch(CROCKFORD);
  });

  it('is deterministic given a seeded random source', () => {
    let n = 0;
    const rand = () => [0, 0.5, 0.99, 0.25, 0.75][n++ % 5];
    expect(generateToken(rand)).toMatch(CROCKFORD);
  });
});

function memFs(initial?: Record<string, string>): ShareTokenFs & { files: Record<string, string> } {
  const files: Record<string, string> = { ...(initial ?? {}) };
  return {
    files,
    existsSync: (p) => p in files || Object.keys(files).some((f) => f.startsWith(`${p}/`)),
    readFileSync: (p) => {
      if (!(p in files)) throw new Error('ENOENT');
      return files[p];
    },
    mkdirSync: () => {},
    writeFileSync: (p, data) => {
      files[p] = data;
    },
  };
}

describe('getOrCreateToken', () => {
  it('returns the stored token when .proto/share.json exists', () => {
    const fs = memFs({ '/proj/.proto/share.json': JSON.stringify({ token: 'N62YV' }) });
    expect(getOrCreateToken('/proj', { fs })).toBe('N62YV');
  });

  it('mints + writes a token when none exists, then returns the same one on re-read', () => {
    const fs = memFs();
    const token = getOrCreateToken('/proj', { fs, rand: () => 0.5 });
    expect(token).toMatch(CROCKFORD);
    // persisted to .proto/share.json
    expect(JSON.parse(fs.files['/proj/.proto/share.json']).token).toBe(token);
    // stable across calls
    expect(getOrCreateToken('/proj', { fs })).toBe(token);
  });

  it('mints a fresh token if the stored file is corrupt', () => {
    const fs = memFs({ '/proj/.proto/share.json': 'not json' });
    expect(getOrCreateToken('/proj', { fs })).toMatch(CROCKFORD);
  });
});
