import { describe, expect, test, vi } from 'vitest';
import { runOpen } from './open.js';

const DEEP_LINK =
  'prototo://expo-development-client/?url=https://prototo.app/api/manifest/AQ3MWZ94J9EK';

function setup(opts: { booted?: boolean; status?: number; body?: unknown } = {}) {
  const calls: string[] = [];
  const logs: string[] = [];
  const run = vi.fn((cmd: string, args: string[]) => {
    calls.push(`${cmd} ${args.join(' ')}`);
    return args.includes('list') ? (opts.booted === false ? '' : '(Booted)') : '';
  });
  const fetchFn = vi.fn(
    async () =>
      new Response(JSON.stringify(opts.body ?? { deepLink: DEEP_LINK }), {
        status: opts.status ?? 200,
      }),
  );
  return {
    calls,
    logs,
    fetchFn,
    deps: {
      run,
      fetch: fetchFn as unknown as typeof fetch,
      env: {},
      log: (m: string) => logs.push(m),
    },
  };
}

describe('runOpen', () => {
  test('resolves a prototo.app link and opens its dev-client link bare on the Simulator', async () => {
    const s = setup();
    expect(await runOpen({ target: 'https://prototo.app/p/AQ3MWZ94J9EK', deps: s.deps })).toBe(
      true,
    );
    expect(s.fetchFn).toHaveBeenCalledWith('https://prototo.app/api/share/AQ3MWZ94J9EK');
    expect(s.calls.at(-1)).toBe(`xcrun simctl openurl booted ${DEEP_LINK}&ui=bare`);
  });

  test('accepts the app-scheme forms and a bare code', async () => {
    for (const target of [
      'prototo://p/AQ3MWZ94J9EK',
      'prototo:///p/AQ3MWZ94J9EK',
      'aq3mwz94j9ek',
    ]) {
      const s = setup();
      expect(await runOpen({ target, deps: s.deps })).toBe(true);
    }
  });

  test('explains usage for a missing or malformed link, without touching the network', async () => {
    const s = setup();
    expect(await runOpen({ target: 'https://prototo.app/p/nope', deps: s.deps })).toBe(false);
    expect(s.fetchFn).not.toHaveBeenCalled();
    expect(s.logs[0]).toContain('Paste a share link');
  });

  test('needs a booted Simulator', async () => {
    const s = setup({ booted: false });
    expect(await runOpen({ target: 'AQ3MWZ94J9EK', deps: s.deps })).toBe(false);
    expect(s.logs[0]).toContain('No booted Simulator');
  });

  test('a 404 or an unexpected deep link is reported as a missing share, and nothing is opened', async () => {
    for (const opts of [{ status: 404 }, { body: { deepLink: 'https://evil.example' } }]) {
      const s = setup(opts);
      expect(await runOpen({ target: 'AQ3MWZ94J9EK', deps: s.deps })).toBe(false);
      expect(s.calls.some((c) => c.includes('openurl'))).toBe(false);
      expect(s.logs[0]).toContain('doesn’t exist');
    }
  });
});
