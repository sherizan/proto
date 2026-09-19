import { describe, expect, it, vi } from 'vitest';
import { messages } from '../messages.js';
import { ShareApiError } from '../share-api.js';
import { type RemixDeps, installSucceeded, parseShareToken, runRemix } from './remix.js';

const TOKEN = 'XK92MABCDEFG';

function makeDeps(over: Partial<RemixDeps> = {}): RemixDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getCliToken: () => 'proto_account',
    login: async () => 'proto_account',
    fetchSource: async () => ({
      url: 'https://signed/get/source.tgz',
      appName: 'Checkout flow',
      designerName: 'Dana',
    }),
    download: async (url, file) => {
      calls.push(`download ${url} -> ${file}`);
    },
    extract: async (file, dest) => {
      calls.push(`extract ${file} -> ${dest}`);
    },
    install: async (dir) => {
      calls.push(`install ${dir}`);
    },
    exists: () => false,
    removeShareToken: (dir) => {
      calls.push(`untoken ${dir}`);
    },
    cwd: () => '/work',
    log: () => {},
    exit: () => {},
    ...over,
  };
}

describe('parseShareToken', () => {
  it('accepts a prototo.app link, a bare token, or a token in any case', () => {
    expect(parseShareToken(`https://prototo.app/p/${TOKEN}`)).toBe(TOKEN);
    expect(parseShareToken(`prototo.app/p/${TOKEN}?x=1`)).toBe(TOKEN);
    expect(parseShareToken(TOKEN)).toBe(TOKEN);
    expect(parseShareToken(TOKEN.toLowerCase())).toBe(TOKEN);
    expect(parseShareToken('nope')).toBeNull();
    expect(parseShareToken('')).toBeNull();
  });
});

describe('runRemix', () => {
  it('downloads, extracts into a folder named after the prototype, drops the token, installs', async () => {
    const logs: string[] = [];
    const deps = makeDeps({ log: (m) => logs.push(m) });
    await runRemix({ target: `https://prototo.app/p/${TOKEN}`, folder: undefined }, deps);
    expect(deps.calls[0]).toMatch(/^download https:\/\/signed\/get\/source\.tgz -> /);
    expect(deps.calls[1]).toMatch(/^extract .* -> \/work\/checkout-flow$/);
    expect(deps.calls[2]).toBe('untoken /work/checkout-flow');
    expect(deps.calls[3]).toBe('install /work/checkout-flow');
    expect(logs).toContain(messages.remixDone('Checkout flow', 'Dana', 'checkout-flow'));
  });

  it('uses the folder the designer asked for', async () => {
    const deps = makeDeps();
    await runRemix({ target: TOKEN, folder: 'my-take' }, deps);
    expect(deps.calls[1]).toMatch(/-> \/work\/my-take$/);
  });

  it('refuses to overwrite an existing folder', async () => {
    const logs: string[] = [];
    const exit = vi.fn();
    const deps = makeDeps({ exists: () => true, log: (m) => logs.push(m), exit });
    await runRemix({ target: TOKEN, folder: undefined }, deps);
    expect(logs).toContain(messages.remixFolderExists('checkout-flow'));
    expect(deps.calls).toHaveLength(0);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('signs the designer in first when there is no token', async () => {
    const login = vi.fn(async () => 'proto_account');
    const deps = makeDeps({ getCliToken: () => null, login });
    await runRemix({ target: TOKEN, folder: undefined }, deps);
    expect(login).toHaveBeenCalled();
    expect(deps.calls.length).toBe(4);
  });

  it('explains a link that is not a share, another team, or no source', async () => {
    for (const [kind, expected] of [
      ['not-on-team', messages.remixNotOnTeam],
      ['no-source', messages.remixNoSource],
      ['not-found', messages.remixNotFound],
      ['unauthorized', messages.shareLoginExpired],
      ['network', messages.shareApiUnreachable],
    ] as const) {
      const logs: string[] = [];
      const deps = makeDeps({
        fetchSource: async () => {
          throw new ShareApiError(kind, kind);
        },
        log: (m) => logs.push(m),
      });
      await runRemix({ target: TOKEN, folder: undefined }, deps);
      expect(logs, kind).toContain(expected);
      expect(deps.calls).toHaveLength(0);
    }
    const logs: string[] = [];
    await runRemix(
      { target: 'garbage', folder: undefined },
      makeDeps({ log: (m) => logs.push(m) }),
    );
    expect(logs).toContain(messages.remixBadLink);
  });
});

describe('installSucceeded', () => {
  it('accepts exit 0, and pnpm’s ignored-build-scripts exit that still installed everything', () => {
    expect(installSucceeded(0, '')).toBe(true);
    expect(
      installSucceeded(
        1,
        ' ERR_PNPM_IGNORED_BUILDS  Ignored build scripts: @shopify/react-native-skia@2.6.2\n',
      ),
    ).toBe(true);
  });

  it('rejects any other non-zero exit', () => {
    expect(installSucceeded(1, 'ERR_PNPM_NO_OFFLINE_META')).toBe(false);
    expect(installSucceeded(null, '')).toBe(false);
  });
});
