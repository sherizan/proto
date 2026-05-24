import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensurePrototoAppMatchesProject,
  parsePrototoAppVersion,
  buildManifestUrl,
  buildTarballUrl,
  PROTOTO_APP_BUNDLE_ID,
  type Manifest,
  type Deps,
} from './ensure-prototo-app.js';

function makeProject(expoVersion: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ensure-prototo-'));
  const expoPkg = path.join(dir, 'node_modules', 'expo');
  fs.mkdirSync(expoPkg, { recursive: true });
  fs.writeFileSync(
    path.join(expoPkg, 'package.json'),
    JSON.stringify({ name: 'expo', version: expoVersion }),
  );
  return dir;
}

function makeCacheDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'proto-cache-'));
}

const VALID_MANIFEST: Manifest = {
  sdkMajor: 55,
  sha256: 'a'.repeat(64),
  builtAt: '2026-05-25T12:00:00Z',
};

describe('PROTOTO_APP_BUNDLE_ID', () => {
  it('is com.sherizan.prototo', () => {
    expect(PROTOTO_APP_BUNDLE_ID).toBe('com.sherizan.prototo');
  });
});

describe('parsePrototoAppVersion', () => {
  it('extracts CFBundleShortVersionString from the Prototo block', () => {
    const sample = `
      "some.other.app" = {
        CFBundleShortVersionString = "99.0.0";
      };
      "com.sherizan.prototo" = {
        ApplicationType = "User";
        CFBundleIdentifier = "com.sherizan.prototo";
        CFBundleShortVersionString = "55.0.1";
      };
    `;
    expect(parsePrototoAppVersion(sample)).toBe('55.0.1');
  });

  it('returns null when Prototo is not installed', () => {
    expect(parsePrototoAppVersion('"com.apple.notes" = { };')).toBe(null);
  });

  it('returns null when block has no version string', () => {
    expect(parsePrototoAppVersion('"com.sherizan.prototo" = { CFBundleIdentifier = "com.sherizan.prototo"; };')).toBe(
      null,
    );
  });
});

describe('buildManifestUrl / buildTarballUrl', () => {
  it('manifest URL uses GitHub Releases latest tag for the given SDK major', () => {
    expect(buildManifestUrl('55')).toBe(
      'https://github.com/sherizan/proto/releases/download/prototo-sim-sdk55-latest/manifest.json',
    );
  });

  it('tarball URL uses the same tag', () => {
    expect(buildTarballUrl('55')).toBe(
      'https://github.com/sherizan/proto/releases/download/prototo-sim-sdk55-latest/Prototo.app.tar.gz',
    );
  });
});

describe('ensurePrototoAppMatchesProject', () => {
  let project: string;
  let cacheDir: string;

  beforeEach(() => {
    project = makeProject('55.0.26');
    cacheDir = makeCacheDir();
  });

  afterEach(() => {
    if (fs.existsSync(project)) fs.rmSync(project, { recursive: true, force: true });
    if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  function joinArgs(args: string[]): string {
    return args.join(' ');
  }

  function makeDeps(overrides: Partial<Deps>): Deps {
    return {
      run: (cmd, args) => {
        const full = `${cmd} ${joinArgs(args)}`;
        if (full.includes('list devices booted')) return '(Booted) iOS 26.0';
        if (full.includes('listapps')) return '';
        return '';
      },
      fetch: vi.fn(async () => new Response(JSON.stringify(VALID_MANIFEST))),
      computeSha256: vi.fn(async () => VALID_MANIFEST.sha256),
      extractTarball: vi.fn(async (_archive, into) => {
        fs.mkdirSync(path.join(into, 'Prototo.app'), { recursive: true });
      }),
      cacheRoot: cacheDir,
      log: () => {},
      ...overrides,
    };
  }

  it('no-ops when no simulator is booted', async () => {
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          return '== Devices ==\n-- iOS 26.0 --\n';
        },
      }),
    });
    expect(calls.some((c) => c.includes('install'))).toBe(false);
  });

  it('no-ops when installed Prototo major matches project SDK', async () => {
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps'))
            return '"com.sherizan.prototo" = { CFBundleShortVersionString = "55.0.1"; };';
          return '';
        },
      }),
    });
    expect(calls.some((c) => c.includes('simctl install'))).toBe(false);
  });

  it('downloads + installs Prototo when missing on a booted simulator', async () => {
    const calls: string[] = [];
    const fetched: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps')) return ''; // not installed
          return '';
        },
        fetch: vi.fn(async (url: string) => {
          fetched.push(url);
          if (url.endsWith('manifest.json')) {
            return new Response(JSON.stringify(VALID_MANIFEST));
          }
          return new Response(new Uint8Array([]));
        }),
      }),
    });
    expect(fetched.some((u) => u.endsWith('manifest.json'))).toBe(true);
    expect(fetched.some((u) => u.endsWith('Prototo.app.tar.gz'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('refreshes Prototo when major version mismatches', async () => {
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps'))
            return '"com.sherizan.prototo" = { CFBundleShortVersionString = "54.0.7"; };';
          return '';
        },
      }),
    });
    expect(calls.some((c) => c.includes('simctl uninstall booted com.sherizan.prototo'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('uses cache when a matching tarball is already on disk', async () => {
    const entryDir = path.join(cacheDir, `55-${VALID_MANIFEST.sha256.slice(0, 12)}`);
    fs.mkdirSync(path.join(entryDir, 'Prototo.app'), { recursive: true });
    fs.writeFileSync(path.join(entryDir, 'manifest.json'), JSON.stringify(VALID_MANIFEST));

    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(VALID_MANIFEST)));
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: fetchSpy,
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps')) return ''; // not installed
          return '';
        },
      }),
    });
    const tarballFetches = fetchSpy.mock.calls.filter(([url]: [string]) =>
      typeof url === 'string' && url.endsWith('.tar.gz'),
    );
    expect(tarballFetches.length).toBe(0);
  });

  it('logs the prototoSimulatorOffline message when offline and cache is stale', async () => {
    const logs: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: vi.fn(async () => {
          throw new Error('ENOTFOUND github.com');
        }),
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps'))
            return '"com.sherizan.prototo" = { CFBundleShortVersionString = "54.0.7"; };';
          return '';
        },
        log: (m) => logs.push(m),
      }),
    });
    expect(logs.some((m) => m.includes('older than this project'))).toBe(true);
  });

  it('no-ops silently when xcrun is unavailable', async () => {
    await expect(
      ensurePrototoAppMatchesProject({
        cwd: project,
        deps: makeDeps({
          run: () => {
            throw new Error('xcrun: command not found');
          },
        }),
      }),
    ).resolves.toBeUndefined();
  });

  it('no-ops when project has no expo dep installed', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-empty-'));
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: empty,
      deps: makeDeps({
        run: (cmd, args) => {
          calls.push(`${cmd} ${joinArgs(args)}`);
          return '';
        },
      }),
    });
    expect(calls.length).toBe(0);
    fs.rmSync(empty, { recursive: true, force: true });
  });

  it('rejects a tarball whose sha256 does not match the manifest', async () => {
    const logs: string[] = [];
    const fetchSpy = vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify(VALID_MANIFEST));
      return new Response(new Uint8Array([1, 2, 3]));
    });
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: fetchSpy,
        computeSha256: vi.fn(async () => 'b'.repeat(64)),
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps')) return '';
          return '';
        },
        log: (m) => logs.push(m),
      }),
    });
    expect(logs.some((m) => m.toLowerCase().includes('hash'))).toBe(true);
  });
});
