import { describe, expect, it, vi } from 'vitest';
import { ShareApiError } from '../share-api.js';
import { runShare, type ShareOrchestratorDeps } from './share.js';

const TOKEN = 'XK92MABCDEFG';
const DEEP_LINK =
  'prototo://expo-development-client/?url=https://u.expo.dev/proj/group/grp-1';

function makeDeps(overrides: Partial<ShareOrchestratorDeps>): ShareOrchestratorDeps {
  return {
    findConfig: () => ({ ok: true, root: '/tmp/p', configPath: '/tmp/p/proto.config.js' }),
    gatherProject: () => ({
      screens: [{ name: 'Home', source: 'x' }],
      config: { name: 'Atlas', initialScreen: 'Home' },
    }),
    getDesignerName: async () => 'Sheri',
    ensureShareConfig: () => true,
    getOrCreateToken: () => TOKEN,
    publishUpdate: async () => ({
      ok: true,
      deepLink: DEEP_LINK,
      updateUrl: 'https://u.expo.dev/proj/group/grp-1',
      groupId: 'grp-1',
    }),
    createShare: async () => ({
      url: `https://prototo.app/p/${TOKEN}`,
      expiresAt: '2026-06-18T00:00:00.000Z',
    }),
    renderQr: () => '[qr]',
    log: () => {},
    error: () => {},
    exit: () => {},
    ...overrides,
  };
}

describe('runShare — cloud-streaming flow', () => {
  it('configures + publishes an EAS Update for the token branch and registers the deep link', async () => {
    const logs: string[] = [];
    const ensureShareConfig = vi.fn(() => true);
    const publishUpdate = vi.fn(makeDeps({}).publishUpdate);
    const createShare = vi.fn(makeDeps({}).createShare);

    await runShare(
      { cliOverride: undefined },
      makeDeps({ log: (m) => logs.push(m), ensureShareConfig, publishUpdate, createShare }),
    );

    expect(ensureShareConfig).toHaveBeenCalledWith('/tmp/p');
    expect(publishUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ root: '/tmp/p', branch: TOKEN }),
    );
    expect(createShare).toHaveBeenCalledWith({
      token: TOKEN,
      designerName: 'Sheri',
      appName: 'Atlas',
      deepLink: DEEP_LINK,
    });
    expect(logs.join('\n')).toContain(`https://prototo.app/p/${TOKEN}`);
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

  it('reports a friendly message and does NOT register when publishing fails', async () => {
    const logs: string[] = [];
    const createShare = vi.fn();
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        publishUpdate: async () => ({ ok: false, error: 'eas: not logged in' }),
        log: (m) => logs.push(m),
        createShare,
      }),
    );
    expect(logs.join('\n')).toContain("Couldn't publish your prototype");
    expect(createShare).not.toHaveBeenCalled();
  });

  it('maps a rate-limited registration to a friendly message', async () => {
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
