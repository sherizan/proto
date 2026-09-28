import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensurePrototoAppMatchesProject,
  parsePrototoAppPath,
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
  sdkMajor: 57,
  sha256: 'a'.repeat(64),
  builtAt: '2026-09-27T12:00:00Z',
};

// The real shape of the Prototo block in `xcrun simctl listapps booted`. The
// marketing version (1.2.0) has nothing to do with the SDK major (57): only the
// bundle on disk (`Path`) identifies a build.
function listappsWithPrototo(appPath: string): string {
  return `
    "com.apple.mobilesafari" =     {
        CFBundleShortVersionString = "26.0";
    };
    "com.sherizan.prototo" =     {
        ApplicationType = User;
        Bundle = "file://${appPath}/";
        CFBundleDisplayName = Prototo;
        CFBundleExecutable = Prototo;
        CFBundleIdentifier = "com.sherizan.prototo";
        CFBundleName = Prototo;
        CFBundleShortVersionString = "1.2.0";
        CFBundleVersion = 1;
        DataContainer = "file:///Users/x/Library/Developer/CoreSimulator/Devices/D/data/Containers/Data/Application/E/";
        Path = "${appPath}";
    };`;
}

// A Prototo.app whose identity is its _CodeSignature/CodeResources content.
function makeApp(parent: string, codeResources: string): string {
  const app = path.join(parent, 'Prototo.app');
  fs.mkdirSync(path.join(app, '_CodeSignature'), { recursive: true });
  fs.writeFileSync(path.join(app, '_CodeSignature', 'CodeResources'), codeResources);
  return app;
}

describe('PROTOTO_APP_BUNDLE_ID', () => {
  it('is com.sherizan.prototo', () => {
    expect(PROTOTO_APP_BUNDLE_ID).toBe('com.sherizan.prototo');
  });
});

describe('parsePrototoAppPath', () => {
  it('extracts the installed bundle Path from the Prototo block', () => {
    expect(parsePrototoAppPath(listappsWithPrototo('/x/Bundle/Application/E/Prototo.app'))).toBe(
      '/x/Bundle/Application/E/Prototo.app',
    );
  });

  it('returns null when Prototo is not installed', () => {
    expect(parsePrototoAppPath('"com.apple.notes" = { Path = "/x/Notes.app"; };')).toBe(null);
  });

  it('returns null when the block has no Path', () => {
    expect(parsePrototoAppPath('"com.sherizan.prototo" = { CFBundleIdentifier = "com.sherizan.prototo"; };')).toBe(
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
  let installedDir: string;

  beforeEach(() => {
    project = makeProject('57.0.12');
    cacheDir = makeCacheDir();
    installedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-sim-installed-'));
  });

  afterEach(() => {
    if (fs.existsSync(project)) fs.rmSync(project, { recursive: true, force: true });
    if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });
    if (fs.existsSync(installedDir)) fs.rmSync(installedDir, { recursive: true, force: true });
  });

  function joinArgs(args: string[]): string {
    return args.join(' ');
  }

  // The cached build the manifest points at, with the given CodeResources.
  function seedCache(codeResources: string): string {
    const entry = path.join(cacheDir, `${VALID_MANIFEST.sdkMajor}-${VALID_MANIFEST.sha256.slice(0, 12)}`);
    const app = makeApp(entry, codeResources);
    fs.writeFileSync(path.join(entry, 'manifest.json'), JSON.stringify(VALID_MANIFEST));
    return app;
  }

  // A booted sim whose `listapps` answers with the given block and whose
  // Expo.plist (read through plutil) reports `runtime`; null → key missing.
  function simRun(o: { listapps: string; runtime?: string | null; calls?: string[] }): Deps['run'] {
    return (cmd, args) => {
      const full = `${cmd} ${joinArgs(args)}`;
      o.calls?.push(full);
      if (full.includes('list devices booted')) return '(Booted)';
      if (full.includes('listapps')) return o.listapps;
      if (cmd === 'plutil') {
        if (o.runtime) return `${o.runtime}\n`;
        throw new Error('No value at that key path');
      }
      return '';
    };
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

  it('leaves the Simulator alone when the installed build IS the one the manifest names', async () => {
    seedCache('build-A');
    const installed = makeApp(installedDir, 'build-A');
    const calls: string[] = [];
    const logs: string[] = [];
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(VALID_MANIFEST)));
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: fetchSpy,
        run: simRun({ listapps: listappsWithPrototo(installed), runtime: 'prototo-57', calls }),
        log: (m) => logs.push(m),
      }),
    });
    // the manifest is what defines "current", so it is still fetched; nothing else happens
    expect(fetchSpy.mock.calls.length).toBe(1);
    expect(calls.some((c) => c.includes('simctl uninstall'))).toBe(false);
    expect(calls.some((c) => c.includes('simctl install'))).toBe(false);
    expect(calls.some((c) => c.startsWith('plutil'))).toBe(false);
    expect(logs).toEqual([]);
  });

  it('downloads + installs Prototo when missing on a booted simulator, saying so first', async () => {
    const calls: string[] = [];
    const fetched: string[] = [];
    const logs: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: simRun({ listapps: '', calls }), // not installed
        fetch: vi.fn(async (url: string) => {
          fetched.push(url);
          if (url.endsWith('manifest.json')) {
            return new Response(JSON.stringify(VALID_MANIFEST));
          }
          return new Response(new Uint8Array([]));
        }),
        log: (m) => logs.push(m),
      }),
    });
    expect(fetched.some((u) => u.endsWith('manifest.json'))).toBe(true);
    expect(fetched.some((u) => u.endsWith('Prototo.app.tar.gz'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl uninstall'))).toBe(false);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
    // the desktop turns these two lines into captions (CONTRACTS.md)
    expect(logs).toEqual([
      'Getting the latest Prototo for the Simulator…',
      'Setting up Prototo on the Simulator…',
    ]);
  });

  it('refreshes Prototo when a newer build for the same SDK is out', async () => {
    seedCache('build-B');
    const installed = makeApp(installedDir, 'build-A');
    const events: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: simRun({ listapps: listappsWithPrototo(installed), runtime: 'prototo-57', calls: events }),
        log: (m) => events.push(m),
      }),
    });
    const settingUp = events.indexOf('Setting up Prototo on the Simulator…');
    const uninstall = events.findIndex((e) => e.includes('simctl uninstall booted com.sherizan.prototo'));
    const install = events.findIndex((e) => e.includes('simctl install booted'));
    expect(uninstall).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(uninstall);
    // the caption goes up before the app disappears from the home screen
    expect(settingUp).toBeGreaterThan(-1);
    expect(settingUp).toBeLessThan(uninstall);
  });

  it('refreshes Prototo when the installed runtime is behind the project', async () => {
    seedCache('build-57');
    const installed = makeApp(installedDir, 'build-56');
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: simRun({ listapps: listappsWithPrototo(installed), runtime: 'prototo-56', calls }),
      }),
    });
    expect(calls.some((c) => c.includes('simctl uninstall booted com.sherizan.prototo'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('uses cache when a matching tarball is already on disk', async () => {
    seedCache('build-A');
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(VALID_MANIFEST)));
    const calls: string[] = [];
    const logs: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: fetchSpy,
        run: simRun({ listapps: '', calls }), // not installed
        log: (m) => logs.push(m),
      }),
    });
    const tarballFetches = fetchSpy.mock.calls.filter(([url]: [string]) =>
      typeof url === 'string' && url.endsWith('.tar.gz'),
    );
    expect(tarballFetches.length).toBe(0);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
    expect(logs.some((m) => m.includes('Getting the latest'))).toBe(false);
  });

  it('stays quiet offline when the installed Prototo already runs this runtime', async () => {
    const installed = makeApp(installedDir, 'build-A');
    const calls: string[] = [];
    const logs: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: vi.fn(async () => {
          throw new Error('ENOTFOUND github.com');
        }),
        run: simRun({ listapps: listappsWithPrototo(installed), runtime: 'prototo-57', calls }),
        log: (m) => logs.push(m),
      }),
    });
    expect(calls.filter((c) => c.startsWith('plutil -extract EXUpdatesRuntimeVersion raw')).length).toBe(1);
    expect(calls.some((c) => c.includes('simctl uninstall') || c.includes('simctl install'))).toBe(false);
    expect(logs).toEqual([]);
  });

  it('logs the prototoSimulatorOffline message when offline and the runtime is behind', async () => {
    const installed = makeApp(installedDir, 'build-56');
    const calls: string[] = [];
    const logs: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        fetch: vi.fn(async () => {
          throw new Error('ENOTFOUND github.com');
        }),
        run: simRun({ listapps: listappsWithPrototo(installed), runtime: 'prototo-56', calls }),
        log: (m) => logs.push(m),
      }),
    });
    expect(logs.some((m) => m.includes('older than this project'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install'))).toBe(false);
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

  it('falls back to DeviceHub when Xcode 27 has no Simulator.app', async () => {
    const calls: string[] = [];
    let bootedYet = false;
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
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
          if (full.includes('open -a Simulator')) {
            throw new Error("Unable to find application named 'Simulator'");
          }
          return '';
        },
      }),
    });
    expect(calls.some((c) => c.includes('open devices://device/open?id=AAAA-BBBB'))).toBe(true);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('boots without opening any simulator window under Prototo Desktop (headless)', async () => {
    const calls: string[] = [];
    let bootedYet = false;
    process.env.PROTO_HEADLESS_SIM = '1';
    try {
      await ensurePrototoAppMatchesProject({
        cwd: project,
        deps: makeDeps({
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
            if (full.includes('simctl boot AAAA-BBBB')) bootedYet = true;
            return '';
          },
        }),
      });
    } finally {
      delete process.env.PROTO_HEADLESS_SIM;
    }
    expect(calls.some((c) => c.includes('simctl boot AAAA-BBBB'))).toBe(true);
    expect(calls.some((c) => c.startsWith('open '))).toBe(false);
    expect(calls.some((c) => c.includes('simctl install booted'))).toBe(true);
  });

  it('uninstalls existing Prototo even when its block has no readable Path', async () => {
    const calls: string[] = [];
    await ensurePrototoAppMatchesProject({
      cwd: project,
      deps: makeDeps({
        run: (cmd, args) => {
          const full = `${cmd} ${joinArgs(args)}`;
          calls.push(full);
          if (full.includes('list devices booted')) return '(Booted)';
          if (full.includes('listapps')) {
            // bundle id present but no Path → can't tell which build → today's behaviour
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
