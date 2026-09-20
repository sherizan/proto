import { describe, expect, it, vi } from 'vitest';
import { runAdd } from './add.js';

function okSpawn(calls: string[][]) {
  return async (cmd: string, args: string[]) => {
    calls.push([cmd, ...args]);
    return { code: 0, stderr: '' };
  };
}

describe('runAdd', () => {
  it('installs via `expo install` and reports success', async () => {
    const calls: string[][] = [];
    const result = await runAdd({
      packages: ['react-native-svg'],
      cwd: '/proj',
      deps: { spawnFn: okSpawn(calls), warnFn: async () => [] },
    });

    expect(result.ok).toBe(true);
    expect(calls[0]).toEqual(['npx', 'expo', 'install', 'react-native-svg']);
  });

  it('refuses with a friendly message when no package is given', async () => {
    const result = await runAdd({ packages: [], cwd: '/proj', deps: { warnFn: async () => [] } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/proto add/);
  });

  it('translates an install failure into designer copy (no raw output)', async () => {
    const result = await runAdd({
      packages: ['bogus-pkg'],
      cwd: '/proj',
      deps: {
        spawnFn: async () => ({ code: 1, stderr: 'npm ERR! 404 Not Found - bogus-pkg' }),
        warnFn: async () => [],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).not.toMatch(/npm ERR|404/);
  });

  it('runs native detection on the added packages and surfaces the warning at add time', async () => {
    const warnFn = vi.fn(async () => ['react-native-maps']);
    const log = vi.fn();
    const result = await runAdd({
      packages: ['react-native-maps'],
      cwd: '/proj',
      deps: { spawnFn: okSpawn([]), warnFn, log },
    });

    expect(result.ok).toBe(true);
    expect(warnFn).toHaveBeenCalledWith({ cwd: '/proj', only: ['react-native-maps'] });
    // The unsupported-native warning must reach the user during `proto add`, not only
    // on the next `proto start`.
    expect(log.mock.calls.some(([m]) => /react-native-maps/.test(m) && /Prototo/.test(m))).toBe(
      true,
    );
  });

  it('does not warn when the added package is supported (JS-only or bundled)', async () => {
    const log = vi.fn();
    await runAdd({
      packages: ['date-fns'],
      cwd: '/proj',
      deps: { spawnFn: okSpawn([]), warnFn: async () => [], log },
    });
    expect(log.mock.calls.some(([m]) => /Prototo/.test(m))).toBe(false);
  });

  it('does not run detection if the install failed', async () => {
    const warnFn = vi.fn(async () => []);
    await runAdd({
      packages: ['react-native-maps'],
      cwd: '/proj',
      deps: { spawnFn: async () => ({ code: 1, stderr: 'boom' }), warnFn },
    });
    expect(warnFn).not.toHaveBeenCalled();
  });
});

describe('runAdd — pnpm build scripts', () => {
  it('allowlists the ignored build script and installs again', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-add-'));
    const yaml = path.join(root, 'pnpm-workspace.yaml');
    fs.writeFileSync(yaml, `node-linker: hoisted\nallowBuilds:\n  cloudflared: true\n`);
    const calls: string[][] = [];
    const spawnFn = async (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      return calls.length === 1
        ? {
            code: 1,
            stderr: '',
            stdout: '[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @shopify/react-native-skia@2.6.2\n',
          }
        : { code: 0, stderr: '', stdout: '' };
    };
    try {
      const result = await runAdd({
        packages: ['@shopify/react-native-skia'],
        cwd: root,
        deps: { spawnFn, warnFn: async () => [] },
      });
      expect(result.ok).toBe(true);
      expect(calls).toHaveLength(2);
      expect(fs.readFileSync(yaml, 'utf8')).toContain(`'@shopify/react-native-skia': true`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('still fails plainly when the install error is something else', async () => {
    const calls: string[][] = [];
    const result = await runAdd({
      packages: ['bogus'],
      cwd: '/proj',
      deps: {
        spawnFn: async (cmd, args) => {
          calls.push([cmd, ...args]);
          return { code: 1, stderr: 'npm ERR! 404', stdout: '' };
        },
        warnFn: async () => [],
      },
    });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });
});
