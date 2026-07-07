import { describe, expect, it } from 'vitest';
import { effectiveTier } from './tier';

const NOW = Date.parse('2026-07-07T00:00:00Z');
const FUTURE = '2027-07-07T00:00:00Z';
const PAST = '2025-07-07T00:00:00Z';

describe('effectiveTier', () => {
  it('is plus for a paid tier', () => {
    expect(effectiveTier({ tier: 'plus', plus_until: null }, NOW)).toBe('plus');
  });

  it('is plus while a comp grant (plus_until) is in the future, even with tier=free', () => {
    expect(effectiveTier({ tier: 'free', plus_until: FUTURE }, NOW)).toBe('plus');
  });

  it('reverts to free once the comp grant has passed', () => {
    expect(effectiveTier({ tier: 'free', plus_until: PAST }, NOW)).toBe('free');
  });

  it('stays plus for a paid tier even after a comp grant lapses', () => {
    expect(effectiveTier({ tier: 'plus', plus_until: PAST }, NOW)).toBe('plus');
  });

  it('treats missing/unknown rows as free', () => {
    expect(effectiveTier(null, NOW)).toBe('free');
    expect(effectiveTier({ tier: 'team' }, NOW)).toBe('free');
  });
});
