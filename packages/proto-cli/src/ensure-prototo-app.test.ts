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
      sleep: async () => {},
      downloadIOSPlatform: async () => true,
      ...overrides,
    };
  }

  const IOS26_RUNTIMES = JSON.stringify({
    runtimes: [
      {
        name: 'iOS 26.0',
        identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-26-0',
        version: '26.0',
        isAvailable: true,
      },
    ],
  });

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
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: fetchSpy,
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
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
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
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

  it('boots an iOS 26 Simulator when none is booted, then proceeds', async () => {
    const calls: string[] = [];
    const logs: string[] = [];
    let bootedYet = false;
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        log: (m) => logs.push(m),
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) {
            return bootedYet ? '(Booted) iOS 26.0' : '== Devices ==\n-- iOS 26.0 --\n';
          }
          if (full.includes('list runtimes')) return IOS26_RUNTIMES;
          if (full.includes('list devices available --json')) {
            return JSON.stringify({
              devices: {
                'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
                  { udid: 'AAAA-BBBB', name: 'iPhone 17 Pro', isAvailable: true },
                ],
              },
            });
          }
          if (full.includes('simctl boot AAAA-BBBB')) {
            bootedYet = true;
            return '';
          }
          if (full.includes('open -a Simulator')) return '';
          if (full.includes('listapps')) return ''; // not installed
          return '';
        },
      }),
    });
    expect(calls.some((c) => c.includes('simctl boot AAAA-BBBB'))).toBe(true);
    expect(calls.some((c) => c.includes('open -a Simulator'))).toBe(true);
    expect(logs.some((m) => m.includes('Starting iOS Simulator'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('uninstalls existing Prototo even when version is unparseable', async () => {
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps')) {
            // bundle id present but no CFBundleShortVersionString
            return '"com.sherizan.prototo" = { CFBundleVersion = 1; };';
          }
          return '';
        },
      }),
    });
    expect(calls.some((c) => c.includes('simctl uninstall booted com.sherizan.prototo'))).toBe(
      true,
    );
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('sets up the iOS 26 runtime and warns loudly when it is missing and download fails', async () => {
    const calls: string[] = [];
    const logs: string[] = [];
    let attempted = false;
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        log: (m) => logs.push(m),
        downloadIOSPlatform: async () => {
          attempted = true;
          return false; // download didn't yield a usable runtime
        },
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '== Devices ==\n';
          if (full.includes('list runtimes')) return JSON.stringify({ runtimes: [] }); // no iOS 26
          if (full.includes('list devices available --json')) return JSON.stringify({ devices: {} });
          return '';
        },
      }),
    });
    expect(attempted).toBe(true); // tried to download instead of silently giving up
    expect(logs.some((m) => m.includes('Setting up the iOS 26 Simulator'))).toBe(true);
    expect(logs.some((m) => m.includes('xcodebuild -downloadPlatform iOS'))).toBe(true); // manual fallback
    // Never reaches boot/install, so the raw Expo CommandError is never triggered.
    expect(calls.some((c) => c.includes('simctl boot'))).toBe(false);
    expect(calls.some((c) => c.includes('simctl install'))).toBe(false);
  });

  it('downloads the iOS 26 runtime when missing, then boots and installs', async () => {
    const calls: string[] = [];
    let runtimeReady = false;
    let bootedYet = false;
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        downloadIOSPlatform: async () => {
          runtimeReady = true;
          return true;
        },
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return bootedYet ? '(Booted)' : '== Devices ==\n';
          if (full.includes('list runtimes'))
            return JSON.stringify({ runtimes: runtimeReady ? [{ name: 'iOS 26.0', isAvailable: true }] : [] });
          if (full.includes('list devices available --json'))
            return JSON.stringify({
              devices: {
                'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
                  { udid: 'CCCC-DDDD', name: 'iPhone 17', isAvailable: true },
                ],
              },
            });
          if (full.includes('simctl boot CCCC-DDDD')) {
            bootedYet = true;
            return '';
          }
          if (full.includes('listapps')) return '';
          return '';
        },
      }),
    });
    expect(runtimeReady).toBe(true);
    expect(calls.some((c) => c.includes('simctl boot CCCC-DDDD'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('warns when the iOS 26 runtime exists but no iPhone device is present', async () => {
    const logs: string[] = [];
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        log: (m) => logs.push(m),
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '== Devices ==\n';
          if (full.includes('list runtimes')) return IOS26_RUNTIMES;
          if (full.includes('list devices available --json')) return JSON.stringify({ devices: {} });
          return '';
        },
      }),
    });
    expect(logs.some((m) => m.includes('add an iPhone'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install'))).toBe(false);
  });
});
