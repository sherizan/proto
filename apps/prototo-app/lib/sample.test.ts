import { describe, it, expect } from 'vitest';
import { SAMPLE } from './sample';
import { isValidShareDeepLink } from './share-lookup';

describe('SAMPLE', () => {
  it('is pinned to a valid share deep link', () => {
    expect(isValidShareDeepLink(SAMPLE.deepLink)).toBe(true);
  });
});
