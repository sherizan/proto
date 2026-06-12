import { describe, expect, it, vi } from 'vitest';
import { type CliTokenFs, readCliToken, saveCliToken } from './cli-token.js';

const HOME = '/home/designer';
const TOKEN = 'proto_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234';

function makeFs(files: Record<string, string>): {
  fs: CliTokenFs;
  writes: { path: string; data: string; mode?: number }[];
  dirs: string[];
} {
  const writes: { path: string; data: string; mode?: number }[] = [];
  const dirs: string[] = [];
  const fs: CliTokenFs = {
    existsSync: (p) => p in files,
    readFileSync: (p) => {
      if (!(p in files)) throw new Error('ENOENT');
      return files[p];
    },
    mkdirSync: (p) => {
      dirs.push(p);
    },
    writeFileSync: (p, data, opts) => {
      files[p] = data;
      writes.push({ path: p, data, mode: opts?.mode });
    },
  };
  return { fs, writes, dirs };
}

describe('readCliToken', () => {
  it('returns null when no token file exists', () => {
    const { fs } = makeFs({});
    expect(readCliToken({ fs, homedir: () => HOME, env: {} })).toBeNull();
  });

  it('reads a saved token from ~/.prototo/api-token.json', () => {
    const { fs } = makeFs({
      '/home/designer/.prototo/api-token.json': JSON.stringify({ token: TOKEN }),
    });
    expect(readCliToken({ fs, homedir: () => HOME, env: {} })).toBe(TOKEN);
  });

  it('returns null when the file is corrupt JSON', () => {
    const { fs } = makeFs({ '/home/designer/.prototo/api-token.json': '{not json' });
    expect(readCliToken({ fs, homedir: () => HOME, env: {} })).toBeNull();
  });

  it('returns null when the token is not a proto_ token', () => {
    const { fs } = makeFs({
      '/home/designer/.prototo/api-token.json': JSON.stringify({ token: 'nope' }),
    });
    expect(readCliToken({ fs, homedir: () => HOME, env: {} })).toBeNull();
  });

  it('prefers PROTO_API_TOKEN over the stored file', () => {
    const { fs } = makeFs({
      '/home/designer/.prototo/api-token.json': JSON.stringify({ token: TOKEN }),
    });
    const envToken = 'proto_FROMENV1234';
    expect(readCliToken({ fs, homedir: () => HOME, env: { PROTO_API_TOKEN: envToken } })).toBe(
      envToken,
    );
  });

  it('ignores a malformed PROTO_API_TOKEN and falls back to the file', () => {
    const { fs } = makeFs({
      '/home/designer/.prototo/api-token.json': JSON.stringify({ token: TOKEN }),
    });
    expect(readCliToken({ fs, homedir: () => HOME, env: { PROTO_API_TOKEN: 'garbage' } })).toBe(
      TOKEN,
    );
  });
});

describe('saveCliToken', () => {
  it('writes the token to ~/.prototo/api-token.json with 0600 perms', () => {
    const { fs, writes, dirs } = makeFs({});
    saveCliToken(TOKEN, { fs, homedir: () => HOME });

    expect(dirs).toContain('/home/designer/.prototo');
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe('/home/designer/.prototo/api-token.json');
    expect(JSON.parse(writes[0].data)).toEqual({ token: TOKEN });
    expect(writes[0].mode).toBe(0o600);
  });

  it('round-trips: a saved token reads back', () => {
    const files: Record<string, string> = {};
    const fs = makeFsBacked(files);
    saveCliToken(TOKEN, { fs, homedir: () => HOME });
    expect(readCliToken({ fs, homedir: () => HOME, env: {} })).toBe(TOKEN);
  });
});

function makeFsBacked(files: Record<string, string>): CliTokenFs {
  return {
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
