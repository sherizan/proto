import { describe, expect, it, vi } from 'vitest';
import { ShareApiError } from '../share-api.js';
import { type ShareOrchestratorDeps, runShare } from './share.js';

const TOKEN = 'XK92MABCDEFG';
const DEEP_LINK = `prototo://expo-development-client/?url=https://prototo.app/api/manifest/${TOKEN}`;

function makeDeps(overrides: Partial<ShareOrchestratorDeps>): ShareOrchestratorDeps {
  return {
    findConfig: () => ({ ok: true, root: '/tmp/p', configPath: '/tmp/p/proto.config.js' }),
    gatherProject: () => ({
      screens: [{ name: 'Home', source: 'x' }],
      config: { name: 'Atlas', initialScreen: 'Home' },
    }),
    getDesignerName: async () => 'Sheri',
    getCliToken: () => 'proto_account',
    login: async () => 'proto_account',
    ensureShareConfig: () => true,
    getOrCreateToken: () => TOKEN,
    publishUpdate: async () => ({ ok: true, deepLink: DEEP_LINK }),
    createShare: async () => ({
      url: `https://prototo.app/p/${TOKEN}`,
      expiresAt: '2026-06-18T00:00:00.000Z',
    }),
    preflightShare: async () => ({ allowed: true, tier: 'free', activeProjects: 0, projectCap: 1 }),
    renderQr: () => '[qr]',
    openBrowser: () => {},
    log: () => {},
    error: () => {},
    exit: () => {},
    ...overrides,
  };
}

describe('runShare — cloud-streaming flow', () => {
  it('publishes the prototype for the token and registers the deep link', async () => {
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
      expect.objectContaining({ root: '/tmp/p', token: TOKEN, accountToken: 'proto_account' }),
    );
    expect(createShare).toHaveBeenCalledWith(
      {
        token: TOKEN,
        designerName: 'Sheri',
        appName: 'Atlas',
        deepLink: DEEP_LINK,
      },
      'proto_account',
    );
    expect(logs.join('\n')).toContain(`https://prototo.app/p/${TOKEN}`);
    expect(logs).toContain('[qr]');
  });

  it('runs the login flow first when the designer is not signed in', async () => {
    const login = vi.fn(async () => 'proto_fresh');
    const createShare = vi.fn(makeDeps({}).createShare);
    await runShare(
      { cliOverride: undefined },
      makeDeps({ getCliToken: () => null, login, createShare }),
    );
    expect(login).toHaveBeenCalledTimes(1);
    expect(createShare).toHaveBeenCalledWith(expect.anything(), 'proto_fresh');
  });

  it('stops without publishing when login does not complete', async () => {
    const login = vi.fn(async () => null);
    const publishUpdate = vi.fn(makeDeps({}).publishUpdate);
    const createShare = vi.fn();
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        getCliToken: () => null,
        login,
        publishUpdate,
        createShare,
        log: (m) => logs.push(m),
      }),
    );
    expect(publishUpdate).not.toHaveBeenCalled();
    expect(createShare).not.toHaveBeenCalled();
  });

  it('maps an expired/invalid token to a friendly re-login message', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async () => {
          throw new ShareApiError('unauthorized', 'Sign-in required');
        },
        log: (m) => logs.push(m),
      }),
    );
    expect(logs.join(' ')).toContain('sign-in expired');
  });

  it('blocks BEFORE publishing and opens the upgrade page when preflight says capped', async () => {
    const logs: string[] = [];
    const opened: string[] = [];
    const publishUpdate = vi.fn(makeDeps({}).publishUpdate);
    const createShare = vi.fn();
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        preflightShare: async () => ({
          allowed: false,
          tier: 'free',
          activeProjects: 1,
          projectCap: 1,
        }),
        publishUpdate,
        createShare,
        openBrowser: (u) => opened.push(u),
        log: (m) => logs.push(m),
      }),
    );
    expect(publishUpdate).not.toHaveBeenCalled();
    expect(createShare).not.toHaveBeenCalled();
    expect(logs.join(' ')).toContain('free sharing limit');
    expect(opened).toContain('https://prototo.app/account');
  });

  it('publishes normally when preflight is unavailable (fail-open null)', async () => {
    const publishUpdate = vi.fn(makeDeps({}).publishUpdate);
    const createShare = vi.fn(makeDeps({}).createShare);
    await runShare(
      { cliOverride: undefined },
      makeDeps({ preflightShare: async () => null, publishUpdate, createShare }),
    );
    expect(publishUpdate).toHaveBeenCalledTimes(1);
    expect(createShare).toHaveBeenCalledTimes(1);
  });

  it('still opens the upgrade page on a post-publish 403 backstop', async () => {
    const logs: string[] = [];
    const opened: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async () => {
          throw new ShareApiError('cap-reached', 'cap');
        },
        openBrowser: (u) => opened.push(u),
        log: (m) => logs.push(m),
      }),
    );
    expect(logs.join(' ')).toContain('free sharing limit');
    expect(opened).toContain('https://prototo.app/account');
  });

  it('maps an owner mismatch to a friendly message', async () => {
    const logs: string[] = [];
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        createShare: async () => {
          throw new ShareApiError('owner-mismatch', 'owner');
        },
        log: (m) => logs.push(m),
      }),
    );
    expect(logs.join(' ')).toContain('another account');
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

  it('reports a friendly message and does NOT register when publishing fails (raw error hidden)', async () => {
    const logs: string[] = [];
    const createShare = vi.fn();
    await runShare(
      { cliOverride: undefined },
      makeDeps({
        // A raw export/upload error must never leak — falls back to the generic line.
        publishUpdate: async () => ({ ok: false, error: 'Metro error: Unable to resolve module' }),
        log: (m) => logs.push(m),
        createShare,
      }),
    );
    const out = logs.join('\n');
    expect(out).toContain('Couldn’t publish your prototype');
    expect(out).not.toContain('Metro');
    expect(createShare).not.toHaveBeenCalled();
  });

  it('maps known publish failures to specific friendly messages', async () => {
    const cases: Array<[string, string]> = [
      ['unauthorized', 'Your sign-in expired'],
      ['owner-mismatch', 'belongs to another account'],
      ['network', 'Can’t reach'],
    ];
    for (const [error, expected] of cases) {
      const logs: string[] = [];
      await runShare(
        { cliOverride: undefined },
        makeDeps({ publishUpdate: async () => ({ ok: false, error }), log: (m) => logs.push(m) }),
      );
      expect(logs.join('\n'), error).toContain(expected);
    }
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
    expect(logs.join(' ')).toContain('Can’t reach');
  });
});
