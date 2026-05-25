import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureCloudflared, type EnsureCloudflaredDeps } from './ensure-cloudflared.js';

function makeRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'proto-cflared-'));
}

function makeDeps(overrides: Partial<EnsureCloudflaredDeps>): EnsureCloudflaredDeps {
  return {
    which: () => null,
    npmBinPath: () => null,
    log: () => {},
    ...overrides,
  };
}

describe('ensureCloudflared', () => {
  let root: string;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('prefers a system-installed cloudflared on PATH', async () => {
    const sysPath = path.join(root, 'usr-bin-cloudflared');
    fs.writeFileSync(sysPath, '');
    const out = await ensureCloudflared({
      deps: makeDeps({
        which: () => sysPath,
        npmBinPath: () => path.join(root, 'npm-cloudflared'),
      }),
    });
    expect(out).toBe(sysPath);
  });

  it('falls back to the npm-managed binary when no system install', async () => {
    const npmPath = path.join(root, 'npm-cloudflared');
    fs.writeFileSync(npmPath, '');
    const out = await ensureCloudflared({
      deps: makeDeps({
        which: () => null,
        npmBinPath: () => npmPath,
      }),
    });
    expect(out).toBe(npmPath);
  });

  it('throws when neither system nor npm-managed path is usable', async () => {
    await expect(
      ensureCloudflared({
        deps: makeDeps({ which: () => null, npmBinPath: () => null }),
      }),
    ).rejects.toThrow();
  });

  it('throws when npm path is reported but file does not exist', async () => {
    await expect(
      ensureCloudflared({
        deps: makeDeps({ which: () => null, npmBinPath: () => path.join(root, 'missing') }),
      }),
    ).rejects.toThrow();
  });

  it('logs which path was chosen', async () => {
    const sysPath = path.join(root, 'sys');
    fs.writeFileSync(sysPath, '');
    const logs: string[] = [];
    await ensureCloudflared({
      deps: makeDeps({
        which: () => sysPath,
        log: (m) => logs.push(m),
      }),
    });
    expect(logs.some((m) => m.toLowerCase().includes('cloudflared'))).toBe(true);
  });
});
