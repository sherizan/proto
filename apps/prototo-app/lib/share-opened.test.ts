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
});
