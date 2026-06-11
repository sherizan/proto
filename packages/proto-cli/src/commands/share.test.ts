import type { Manifest } from '@sherizan/proto-manifest';
import { describe, expect, it, vi } from 'vitest';
import { ShareApiError } from '../share-api.js';
import { runShare, type ShareOrchestratorDeps } from './share.js';

const MANIFEST: Manifest = {
  manifestVersion: '1',
  app: { name: 'Atlas' },
  initialScreen: 'Home',
  screens: { Home: { type: 'Screen', children: [] } },
};

function makeDeps(overrides: Partial<ShareOrchestratorDeps>): ShareOrchestratorDeps {
  return {
    findConfig: () => ({ ok: true, root: '/tmp/p', configPath: '/tmp/p/proto.config.js' }),
    gatherProject: () => ({
      screens: [{ name: 'Home', source: 'x' }],
      config: { name: 'Atlas', initialScreen: 'Home' },
    }),
    compileManifest: () => ({ ok: true, manifest: MANIFEST, warnings: [] }),
    getDesignerName: async () => 'Sheri',
    createShare: async () => ({
      token: 'XK92M',
      url: 'https://prototo.app/p/XK92M',
      expiresAt: '2026-06-18T00:00:00.000Z',
    }),
    renderQr: () => '[qr]',
    log: () => {},
    error: () => {},
    exit: () => {},
    ...overrides,
  };
}

describe('runShare — manifest flow', () => {
  it('compiles the project, uploads the manifest, and logs the share URL + QR', async () => {
    const logs: string[] = [];
    const createShare = vi.fn(makeDeps({}).createShare);
    const compileManifest = vi.fn(() => ({ ok: true as const, manifest: MANIFEST, warnings: [] }));
    await runShare(
      { cliOverride: undefined },
      makeDeps({ log: (m) => logs.push(m), createShare, compileManifest }),
    );

    expect(compileManifest).toHaveBeenCalledWith([{ name: 'Home', source: 'x' }], {
      name: 'Atlas',
      initialScreen: 'Home',
    });
    expect(createShare).toHaveBeenCalledWith({
      designerName: 'Sheri',
      appName: 'Atlas',
      manifest: MANIFEST,
    });
    expect(logs.join('\n')).toContain('https://prototo.app/p/XK92M');
    expect(logs).toContain('[qr]');
  });

  it('stops with the config reason when no project is found', async () => {
    const errors: string[] = [];
    const createShare = vi.fn();
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        findConfig: () => ({ ok: false, reason: 'Run this inside a Prototo project.' }),
        error: (m) => errors.push(m),
        createShare,
      }),
    );
    expect(errors.join(' ')).toContain('Prototo project');
    expect(createShare).not.toHaveBeenCalled();
  });

  it('surfaces a friendly message when the project can not be gathered', async () => {
    const logs: string[] = [];
    const createShare = vi.fn();
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        gatherProject: () => {
          throw new Error('proto.config.js missing "name"');
        },
        log: (m) => logs.push(m),
        createShare,
      }),
    );
    expect(logs.join(' ')).toContain('Something looked off');
    expect(createShare).not.toHaveBeenCalled();
  });

  it('reports compile errors and does NOT upload', async () => {
    const logs: string[] = [];
    const createShare = vi.fn();
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        compileManifest: () => ({
          ok: false,
          errors: ["Home: This screen uses something Prototo can't share yet: <Marquee>."],
        }),
        log: (m) => logs.push(m),
        createShare,
      }),
    );
    expect(logs.join('\n')).toContain('Marquee');
    expect(logs.join('\n')).toContain("can't be shared yet");
    expect(createShare).not.toHaveBeenCalled();
  });

  it('logs warnings but still uploads', async () => {
    const logs: string[] = [];
    const createShare = vi.fn(makeDeps({}).createShare);
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        compileManifest: () => ({
          ok: true,
          manifest: MANIFEST,
          warnings: ['State "darkMode" set different initial values; the last one wins.'],
        }),
        log: (m) => logs.push(m),
        createShare,
      }),
    );
    expect(logs.join('\n')).toContain('darkMode');
    expect(createShare).toHaveBeenCalled();
  });

  it('maps a rate-limited upload to a friendly message', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async () => {
          throw new ShareApiError('rate-limited', 'Rate limited');
        },
        log: (m) => logs.push(m),
      }),
    );
    expect(logs.join(' ')).toContain('shared a lot recently');
  });

  it('maps a network failure to the unreachable message', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async () => {
          throw new ShareApiError('network', 'down');
        },
        log: (m) => logs.push(m),
      }),
    );
    expect(logs.join(' ')).toContain("Can't reach");
  });
});
