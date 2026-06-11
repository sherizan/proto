import { describe, it, expect } from 'vitest';
import { fetchManifest } from './fetch-manifest';

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

describe('fetchManifest', () => {
  it('returns the manifest on a 200 with { manifest }', async () => {
    const fetchFn = async (url: string) => {
      expect(url).toBe(`${BASE}/api/share/N62YV`);
      return jsonResponse({ designerName: 'Sheri', appName: 'Atlas', manifest: MANIFEST });
    };
    const res = await fetchManifest('N62YV', { fetch: fetchFn as typeof fetch, baseUrl: BASE });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.manifest).toEqual(MANIFEST);
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
