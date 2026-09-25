import { describe, expect, it } from 'vitest';
import { redirectConnectPath } from './connect-intent';

const LINK = 'prototo://expo-development-client/?url=http%3A%2F%2F192.168.5.195%3A8081';

describe('redirectConnectPath', () => {
  it('routes a dev-client connect link to /open with the whole link as a param', () => {
    expect(redirectConnectPath(LINK)).toBe(`/open?url=${encodeURIComponent(LINK)}`);
  });

  it('leaves every other path alone', () => {
    expect(redirectConnectPath('prototo:///p/ABCDEFGHJKMN')).toBeUndefined();
    expect(redirectConnectPath('https://prototo.app/p/ABCDEFGHJKMN')).toBeUndefined();
    expect(redirectConnectPath(null)).toBeUndefined();
    expect(redirectConnectPath('')).toBeUndefined();
  });
});
