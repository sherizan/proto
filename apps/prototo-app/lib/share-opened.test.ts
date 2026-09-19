import { describe, it, expect } from 'vitest';
import { pingShareOpened } from './share-opened';

describe('pingShareOpened', () => {
  it('POSTs the token path with the Bearer when signed in', async () => {
    let url = '';
    let auth: string | undefined;
    await pingShareOpened('AAAAAAAAAAAA', 'jwt123', {
      baseUrl: 'https://x',
      fetch: async (u, init) => {
        url = String(u);
        auth = (init?.headers as Record<string, string>).Authorization;
        return new Response(null, { status: 204 });
      },
    });
    expect(url).toBe('https://x/api/share/AAAAAAAAAAAA/opened');
    expect(auth).toBe('Bearer jwt123');
  });

  it('omits the header without a token and swallows failures', async () => {
    let auth: unknown = 'sentinel';
    await pingShareOpened('AAAAAAAAAAAA', undefined, {
      baseUrl: 'https://x',
      fetch: async (_u, init) => {
        auth = (init?.headers as Record<string, string>).Authorization;
        throw new Error('offline');
      },
    });
    expect(auth).toBeUndefined();
    // reaching here without throwing IS the assertion
  });

  it('sends a JSON body when a reason is given (stale-runtime opens)', async () => {
    let body: unknown;
    let contentType: string | undefined;
    await pingShareOpened('AAAAAAAAAAAA', 'jwt123', {
      baseUrl: 'https://x',
      body: { reason: 'stale_runtime', published: 'prototo-56', own: 'prototo-57' },
      fetch: async (_u, init) => {
        body = JSON.parse(String(init?.body));
        contentType = (init?.headers as Record<string, string>)['Content-Type'];
        return new Response(null, { status: 204 });
      },
    });
    expect(body).toEqual({ reason: 'stale_runtime', published: 'prototo-56', own: 'prototo-57' });
    expect(contentType).toBe('application/json');
  });
});
