import { describe, it, expect } from 'vitest';
import { fetchManifest, tokenFromUrl, tokenFromInput } from './fetch-manifest';

const MANIFEST = {
  manifestVersion: '1',
  app: { name: 'Atlas', theme: 'liquidGlass' },
  initialScreen: 'Home',
  screens: { Home: { type: 'Screen', children: [] } },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const BASE = 'https://prototo.app';

describe('tokenFromUrl', () => {
  const cases: [string | null, string | null][] = [
    ['https://prototo.app/p/N62YV', 'N62YV'],
    ['https://prototo.app/p/n62yv', 'N62YV'],
    ['https://prototo.app/p/N62YV?utm=x', 'N62YV'],
    ['https://prototo.app/p/N62YV/', 'N62YV'],
    ['exp://192.168.8.2:8081', null],
    [null, null],
    ['https://prototo.app/p/ILOU1', null], // excluded letters -> not a valid token
  ];
  for (const [url, want] of cases) {
    it(`${JSON.stringify(url)} -> ${JSON.stringify(want)}`, () => {
      expect(tokenFromUrl(url)).toBe(want);
    });
  }
});

describe('tokenFromInput', () => {
  it('accepts a bare 5-char code (uppercased, trimmed)', () => {
    expect(tokenFromInput('N62YV')).toBe('N62YV');
    expect(tokenFromInput('  n62yv  ')).toBe('N62YV');
  });
  it('accepts a full prototo.app link', () => {
    expect(tokenFromInput('https://prototo.app/p/N62YV')).toBe('N62YV');
  });
  it('rejects invalid input', () => {
    expect(tokenFromInput('')).toBe(null);
    expect(tokenFromInput('hello')).toBe(null);
    expect(tokenFromInput('ILOU1')).toBe(null);
    expect(tokenFromInput('TOOLONG')).toBe(null);
  });
});

describe('fetchManifest', () => {
  it('returns the manifest on a 200 with { manifest }', async () => {
    const fetchFn = async (url: string) => {
      expect(url).toBe(`${BASE}/api/share/N62YV`);
      return jsonResponse({ designerName: 'Sheri', appName: 'Atlas', manifest: MANIFEST });
    };
    const res = await fetchManifest('N62YV', { fetch: fetchFn as typeof fetch, baseUrl: BASE });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.manifest).toEqual(MANIFEST);
      expect(res.appName).toBe('Atlas');
      expect(res.designerName).toBe('Sheri');
    }
  });

  it('falls back to manifest.app.name / "Someone" when the response omits names', async () => {
    const fetchFn = async () => jsonResponse({ manifest: MANIFEST });
    const res = await fetchManifest('N62YV', { fetch: fetchFn as typeof fetch, baseUrl: BASE });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.appName).toBe('Atlas');
      expect(res.designerName).toBe('Someone');
    }
  });

  it('classifies 404 as expired', async () => {
    const fetchFn = async () => jsonResponse({ error: 'not found' }, 404);
    const res = await fetchManifest('ZZZZZ', { fetch: fetchFn as typeof fetch, baseUrl: BASE });
    expect(res).toMatchObject({ ok: false, kind: 'expired' });
  });

  it('classifies a non-ok status as unreachable', async () => {
    const fetchFn = async () => jsonResponse({ error: 'boom' }, 500);
    const res = await fetchManifest('N62YV', { fetch: fetchFn as typeof fetch, baseUrl: BASE });
    expect(res).toMatchObject({ ok: false, kind: 'unreachable' });
  });

  it('classifies a network failure as unreachable', async () => {
    const fetchFn = async () => {
      throw new Error('offline');
    };
    const res = await fetchManifest('N62YV', { fetch: fetchFn as typeof fetch, baseUrl: BASE });
    expect(res).toMatchObject({ ok: false, kind: 'unreachable' });
  });

  it('classifies non-JSON / missing manifest as unreachable', async () => {
    const fetchFn = async () =>
      new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } });
    const res = await fetchManifest('N62YV', { fetch: fetchFn as typeof fetch, baseUrl: BASE });
    expect(res).toMatchObject({ ok: false, kind: 'unreachable' });
  });

  it('rejects an empty token as expired without fetching', async () => {
    let called = false;
    const fetchFn = async () => {
      called = true;
      return jsonResponse({});
    };
    const res = await fetchManifest('', { fetch: fetchFn as typeof fetch, baseUrl: BASE });
    expect(res).toMatchObject({ ok: false, kind: 'expired' });
    expect(called).toBe(false);
  });
});
