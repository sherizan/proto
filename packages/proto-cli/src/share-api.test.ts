import { describe, expect, it, vi } from 'vitest';
import {
  SHARE_API_BASE_DEFAULT,
  ShareApiError,
  type ShareCreateInput,
  createShare,
  lookupShare,
  preflightShare,
} from './share-api.js';

const DEEP_LINK = 'prototo://expo-development-client/?url=https://u.expo.dev/proj/group/grp-1';

const VALID_INPUT: ShareCreateInput = {
  token: 'XK92MABCDEFG',
  designerName: 'Sheri',
  appName: 'Atlas',
  deepLink: DEEP_LINK,
};

const VALID_RESPONSE = {
  url: 'https://prototo.app/p/XK92MABCDEFG',
  expiresAt: '2026-06-01T00:00:00.000Z',
};

describe('SHARE_API_BASE_DEFAULT', () => {
  it('points at the prototo.app production host', () => {
    expect(SHARE_API_BASE_DEFAULT).toBe('https://prototo.app');
  });
});

describe('createShare', () => {
  it('POSTs to /api/share with the JSON body + Bearer token and returns the parsed response', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => VALID_RESPONSE,
    })) as unknown as typeof fetch;

    const result = await createShare(VALID_INPUT, { fetch: fetchSpy, token: 'proto_secret' });

    expect(result).toEqual(VALID_RESPONSE);
    const [url, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://prototo.app/api/share');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer proto_secret',
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(VALID_INPUT);
  });

  it('throws ShareApiError with kind="unauthorized" on 401', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Sign in with `proto login` to share.' }),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });

  it('throws ShareApiError with kind="cap-reached" on 403', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'cap', code: 'cap_reached' }),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'cap-reached',
    });
  });

  it('throws ShareApiError with kind="owner-mismatch" on 409', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: 'owner', code: 'owner_mismatch' }),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'owner-mismatch',
    });
  });

  it('honours PROTO_SHARE_API_BASE env override', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => VALID_RESPONSE,
    })) as unknown as typeof fetch;

    await createShare(VALID_INPUT, { fetch: fetchSpy, baseUrl: 'https://staging.prototo.app' });
    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://staging.prototo.app/api/share');
  });

  it('throws ShareApiError with kind="rate-limited" on 429', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      name: 'ShareApiError',
      kind: 'rate-limited',
    });
  });

  it('throws ShareApiError with kind="bad-input" on 400', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'bad-input',
    });
  });

  it('throws ShareApiError with kind="server" on 5xx', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'server',
    });
  });

  it('throws ShareApiError with kind="network" when fetch rejects', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('ENOTFOUND prototo.app');
    }) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('rejects locally on invalid input before fetching', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    await expect(
      createShare({ ...VALID_INPUT, designerName: '' } as ShareCreateInput, { fetch: fetchSpy }),
    ).rejects.toMatchObject({ kind: 'bad-input' });
    expect((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('rejects when the server returns a body that does not match the schema', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ expiresAt: '2026-06-01T00:00:00.000Z' }), // missing url
    })) as unknown as typeof fetch;

    await expect(createShare(VALID_INPUT, { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'bad-response',
    });
  });
});

describe('lookupShare', () => {
  it('GETs /api/share/<token> and returns the parsed response', async () => {
    const body = {
      designerName: 'Sheri',
      appName: 'Atlas',
      deepLink: DEEP_LINK,
      createdAt: '2026-05-25T00:00:00.000Z',
      expiresAt: '2026-06-01T00:00:00.000Z',
    };
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => body,
    })) as unknown as typeof fetch;

    const result = await lookupShare('xk92m', { fetch: fetchSpy });
    expect(result).toEqual(body);
    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://prototo.app/api/share/xk92m');
  });

  it('throws ShareApiError with kind="not-found" on 404', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('throws ShareApiError with kind="server" on 5xx', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'server',
    });
  });

  it('throws ShareApiError with kind="network" when fetch rejects', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('ENOTFOUND prototo.app');
    }) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('throws ShareApiError with kind="bad-response" on malformed JSON', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json');
      },
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'bad-response',
    });
  });

  it('throws ShareApiError with kind="bad-response" when schema fails', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ designerName: 'only-this-field' }),
    })) as unknown as typeof fetch;

    await expect(lookupShare('xk92m', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'bad-response',
    });
  });

  it('rejects locally on empty token before fetching', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;
    await expect(lookupShare('   ', { fetch: fetchSpy })).rejects.toMatchObject({
      kind: 'bad-input',
    });
    expect((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});

describe('preflightShare', () => {
  const ALLOWED = { allowed: true, tier: 'free', activeProjects: 0, projectCap: 1 };
  const CAPPED = { allowed: false, tier: 'free', activeProjects: 1, projectCap: 1 };

  it('POSTs to /api/share/preflight with the token + Bearer and returns the parsed result', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ALLOWED,
    })) as unknown as typeof fetch;

    const result = await preflightShare('XK92MABCDEFG', { fetch: fetchSpy, token: 'proto_secret' });

    expect(result).toEqual(ALLOWED);
    const [url, init] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://prototo.app/api/share/preflight');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer proto_secret' });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ token: 'XK92MABCDEFG' });
  });

  it('returns the capped result so the caller can block before publishing', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => CAPPED,
    })) as unknown as typeof fetch;

    expect(await preflightShare('XK92MABCDEFG', { fetch: fetchSpy })).toEqual(CAPPED);
  });

  it('honours PROTO_SHARE_API_BASE / baseUrl override', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ALLOWED,
    })) as unknown as typeof fetch;

    await preflightShare('XK92MABCDEFG', {
      fetch: fetchSpy,
      baseUrl: 'https://staging.prototo.app',
    });
    const [url] = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://staging.prototo.app/api/share/preflight');
  });

  it('is fail-open: returns null on a non-200 (e.g. endpoint not deployed)', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    expect(await preflightShare('XK92MABCDEFG', { fetch: fetchSpy })).toBeNull();
  });

  it('is fail-open: returns null when fetch rejects (offline)', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('ENOTFOUND prototo.app');
    }) as unknown as typeof fetch;

    expect(await preflightShare('XK92MABCDEFG', { fetch: fetchSpy })).toBeNull();
  });

  it('is fail-open: returns null on a body that does not match the schema', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ allowed: 'yes' }),
    })) as unknown as typeof fetch;

    expect(await preflightShare('XK92MABCDEFG', { fetch: fetchSpy })).toBeNull();
  });
});
