import { describe, it, expect } from 'vitest';
import { relativeTime } from './relative-time';

const NOW = new Date('2026-06-23T12:00:00Z');

describe('relativeTime', () => {
  it('under a minute → just now', () => expect(relativeTime('2026-06-23T11:59:30Z', NOW)).toBe('just now'));
  it('minutes', () => expect(relativeTime('2026-06-23T11:30:00Z', NOW)).toBe('30m ago'));
  it('hours', () => expect(relativeTime('2026-06-23T09:00:00Z', NOW)).toBe('3h ago'));
  it('days', () => expect(relativeTime('2026-06-21T12:00:00Z', NOW)).toBe('2d ago'));
  it('a week or more → a date', () => expect(relativeTime('2026-06-10T12:00:00Z', NOW)).toBe('Jun 10'));
  it('bad input → empty string', () => expect(relativeTime('not a date', NOW)).toBe(''));
});
