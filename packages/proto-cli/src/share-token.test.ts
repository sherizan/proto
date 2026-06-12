import { describe, it, expect } from 'vitest';
import {
  generateToken,
  getOrCreateToken,
  SHARE_TOKEN_LENGTH,
  type ShareTokenFs,
} from './share-token.js';

const CROCKFORD = new RegExp(`^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{${SHARE_TOKEN_LENGTH}}$`);
const TOKEN = 'N62YVABCDEFG'; // a 12-char sample

describe('generateToken', () => {
  it('returns a wide Crockford token (no I/L/O/U), CSPRNG by default', () => {
    for (let i = 0; i < 200; i++) expect(generateToken()).toMatch(CROCKFORD);
  });

  it('is deterministic given an injected index picker', () => {
    let n = 0;
    const pick = () => [0, 5, 31, 9][n++ % 4]; // valid indices into the 32-char alphabet
    expect(generateToken(pick)).toMatch(CROCKFORD);
  });
});

function memFs(initial?: Record<string, string>): ShareTokenFs & { files: Record<string, string> } {
  const files: Record<string, string> = { ...(initial ?? {}) };
  return {
    files,
    existsSync: (p) => p in files,
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
    const fs = memFs({ '/proj/.proto/share.json': JSON.stringify({ token: TOKEN }) });
    expect(getOrCreateToken('/proj', { fs })).toBe(TOKEN);
  });

  it('mints + writes a token when none exists, then returns the same one on re-read', () => {
    const fs = memFs();
    const token = getOrCreateToken('/proj', { fs, pick: () => 7 });
    expect(token).toMatch(CROCKFORD);
    expect(JSON.parse(fs.files['/proj/.proto/share.json']).token).toBe(token);
    expect(getOrCreateToken('/proj', { fs })).toBe(token);
  });

  it('mints a fresh token if the stored file is corrupt', () => {
    const fs = memFs({ '/proj/.proto/share.json': 'not json' });
    expect(getOrCreateToken('/proj', { fs })).toMatch(CROCKFORD);
  });

  it('mints a fresh token if the stored token is the wrong length (e.g. an old 5-char token)', () => {
    const fs = memFs({ '/proj/.proto/share.json': JSON.stringify({ token: 'N62YV' }) });
    const token = getOrCreateToken('/proj', { fs });
    expect(token).toMatch(CROCKFORD);
    expect(token).not.toBe('N62YV');
  });
});
