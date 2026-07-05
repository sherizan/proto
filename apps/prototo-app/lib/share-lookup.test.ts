import { describe, expect, it } from 'vitest';
import { fetchShare, isValidShareDeepLink } from './share-lookup';

const GROUP = 'abcdef12-3456-7890-abcd-ef1234567890';
const VALID_DEEP_LINK = `prototo://expo-development-client/?url=https://u.expo.dev/8c8ddf7d-1f6a-4b21-a7cc-116ec4d72c6d/group/${GROUP}`;

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const SELF_HOSTED_DEEP_LINK =
  'prototo://expo-development-client/?url=https://prototo.app/api/manifest/XK92MABCDEFG';

describe('isValidShareDeepLink', () => {
  it('accepts a deep link pinned to the central share project', () => {
    expect(isValidShareDeepLink(VALID_DEEP_LINK)).toBe(true);
  });

  it('accepts a self-hosted prototo.app manifest deep link', () => {
    expect(isValidShareDeepLink(SELF_HOSTED_DEEP_LINK)).toBe(true);
  });

  it('rejects a manifest link on the wrong host or a bad token', () => {
    expect(
      isValidShareDeepLink('prototo://expo-development-client/?url=https://evil.app/api/manifest/XK92MABCDEFG'),
    ).toBe(false);
    expect(
      isValidShareDeepLink('prototo://expo-development-client/?url=https://prototo.app/api/manifest/short'),
    ).toBe(false);
  });

  it('rejects a deep link for a different project id', () => {
    expect(
      isValidShareDeepLink(
        `prototo://expo-development-client/?url=https://u.expo.dev/00000000-0000-0000-0000-000000000000/group/${GROUP}`,
      ),
    ).toBe(false);
  });

  it('rejects a non-expo url and a non-prototo scheme', () => {
    expect(
      isValidShareDeepLink('prototo://expo-development-client/?url=https://evil.example.com/x'),
    ).toBe(false);
    expect(isValidShareDeepLink('exp://192.168.1.10:8081')).toBe(false);
  });
});

describe('fetchShare', () => {
  it('returns the share on a valid 200 response', async () => {
    const fetchFn = async () =>
      jsonResponse(200, { designerName: 'Ada', appName: 'Surf', deepLink: VALID_DEEP_LINK });
    const result = await fetchShare('ABCDEFGHJKMN', { fetch: fetchFn });
    expect(result).toEqual({
      ok: true,
      share: { designerName: 'Ada', appName: 'Surf', deepLink: VALID_DEEP_LINK },
    });
  });

  it('maps 404 to not-found', async () => {
    const result = await fetchShare('ABCDEFGHJKMN', {
      fetch: async () => jsonResponse(404, { error: 'nope' }),
    });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  it('rejects a 200 whose deepLink is not central-project-pinned (invalid)', async () => {
    const fetchFn = async () =>
      jsonResponse(200, {
        designerName: 'Ada',
        appName: 'Surf',
        deepLink: 'prototo://expo-development-client/?url=https://evil.example.com/x',
      });
    const result = await fetchShare('ABCDEFGHJKMN', { fetch: fetchFn });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('maps a network throw to network', async () => {
    const fetchFn = async () => {
      throw new Error('offline');
    };
    const result = await fetchShare('ABCDEFGHJKMN', { fetch: fetchFn });
    expect(result).toEqual({ ok: false, reason: 'network' });
  });
});
