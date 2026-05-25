import { describe, it, expect, vi } from 'vitest';
import { runShare, type ShareOrchestratorDeps } from './share.js';
import { ShareApiError } from '../share-api.js';

function noopHandle() {
  return { kill: async () => {}, waitUntilExit: Promise.resolve(0) };
}

function makeDeps(overrides: Partial<ShareOrchestratorDeps>): ShareOrchestratorDeps {
  return {
    findConfig: () => ({ ok: true, root: '/tmp/p', configPath: '/tmp/p/proto.config.js' }),
    readProjectMetadata: () => ({ appName: 'Atlas', screenCount: 7, theme: 'liquid-glass' }),
    getDesignerName: async () => 'Sheri',
    killPort: async () => ({ killed: 0 }),
    startPromptServer: async () => ({ port: 3001, close: async () => {} }),
    ensurePrototoAppMatchesProject: async () => {},
    spawnExpo: () => noopHandle(),
    waitForMetroReady: async () => {},
    ensureCloudflared: async () => '/bin/cloudflared',
    startCloudflareTunnel: () => ({
      tunnelUrl: Promise.resolve('https://t.trycloudflare.com'),
      kill: async () => {},
    }),
    createShare: async () => ({
      token: 'xk92m',
      url: 'https://prototo.app/p/xk92m',
      expiresAt: '2026-06-01T00:00:00Z',
    }),
    renderQr: () => '[QR]',
    log: () => {},
    onShutdown: () => {},
    ...overrides,
  };
}

describe('runShare', () => {
  it('runs the full happy path and resolves', async () => {
    const calls: string[] = [];
    const log = (m: string): void => {
      calls.push(m);
    };
    await runShare({ cliOverride: undefined }, makeDeps({ log }));
    expect(calls.some((m) => m.includes('Setting up your share'))).toBe(true);
    expect(calls.some((m) => m.includes('Your prototype is live'))).toBe(true);
    expect(calls.some((m) => m.includes('Scan to open'))).toBe(true);
    expect(calls.some((m) => m.includes('Keep Prototo running'))).toBe(true);
  });

  it('exits cleanly when findConfig fails', async () => {
    const errors: string[] = [];
    const exit = vi.fn();
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        findConfig: () => ({ ok: false, reason: 'Not a Prototo project' }),
        log: () => {},
        exit: ((code: number) => {
          exit(code);
          throw new Error('exited');
        }) as unknown as ShareOrchestratorDeps['exit'],
        error: (m) => errors.push(m),
      }),
    ).catch(() => {});
    expect(errors.some((m) => m.includes('Not a Prototo project'))).toBe(true);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('passes --as override into getDesignerName', async () => {
    const seen: Array<string | undefined> = [];
    await runShare(
      { cliOverride: 'CLI Sheri' },
      makeDeps({
        getDesignerName: async ({ cliOverride }) => {
          seen.push(cliOverride);
          return cliOverride ?? 'fallback';
        },
      }),
    );
    expect(seen).toEqual(['CLI Sheri']);
  });

  it('POSTs the right shape to createShare', async () => {
    const seen: unknown[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async (body) => {
          seen.push(body);
          return { token: 'xk92m', url: 'https://prototo.app/p/xk92m', expiresAt: 'x' };
        },
      }),
    );
    expect(seen[0]).toMatchObject({
      designerName: 'Sheri',
      appName: 'Atlas',
      screenCount: 7,
      theme: 'liquid-glass',
      tunnelUrl: 'https://t.trycloudflare.com',
    });
  });

  it('logs shareRateLimited when createShare throws kind="rate-limited"', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async () => {
          throw new ShareApiError('rate-limited', 'x');
        },
        log: (m) => logs.push(m),
      }),
    ).catch(() => {});
    expect(logs.some((m) => m.includes("You've shared a lot recently"))).toBe(true);
  });

  it('logs shareApiUnreachable on network errors', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async () => {
          throw new ShareApiError('network', 'x');
        },
        log: (m) => logs.push(m),
      }),
    ).catch(() => {});
    expect(logs.some((m) => m.includes("Can't reach Prototo's share service"))).toBe(true);
  });

  it('logs shareTunnelFailed when startCloudflareTunnel rejects', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        startCloudflareTunnel: () => ({
          tunnelUrl: Promise.reject(new Error('cloudflared timeout')),
          kill: async () => {},
        }),
        log: (m) => logs.push(m),
      }),
    ).catch(() => {});
    expect(logs.some((m) => m.includes("Couldn't start the share tunnel"))).toBe(true);
  });

  it('shuts down tunnel + expo + prompt server on shutdown signal', async () => {
    const killed = { tunnel: false, expo: false, server: false };
    let shutdownFn: (() => Promise<void>) | null = null;

    // expo.kill() resolves waitUntilExit (mirrors real ChildProcess)
    let resolveExpoExit: (() => void) | null = null;
    const expoWaitPromise = new Promise<number | null>((resolve) => {
      resolveExpoExit = () => resolve(0);
    });

    const sharePromise = runShare(
      { cliOverride: undefined },
      makeDeps({
        startCloudflareTunnel: () => ({
          tunnelUrl: Promise.resolve('https://t.trycloudflare.com'),
          kill: async () => {
            killed.tunnel = true;
          },
        }),
        spawnExpo: () => ({
          kill: async () => {
            killed.expo = true;
            resolveExpoExit?.();
          },
          waitUntilExit: expoWaitPromise,
        }),
        startPromptServer: async () => ({
          port: 3001,
          close: async () => {
            killed.server = true;
          },
        }),
        onShutdown: (fn) => {
          shutdownFn = fn;
        },
      }),
    );

    // Yield so the orchestrator finishes setup + registers shutdown
    await new Promise((r) => setTimeout(r, 20));
    expect(shutdownFn).not.toBeNull();
    await shutdownFn!();
    await sharePromise;
    expect(killed).toEqual({ tunnel: true, expo: true, server: true });
  });
});
