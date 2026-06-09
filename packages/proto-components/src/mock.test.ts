import { describe, expect, it } from 'vitest';
import { mock } from './mock';

describe('mock', () => {
  it('returns the same value reference it is given', () => {
    const obj = { wave: '0.8m', wind: '8 km/h' };
    expect(mock(obj)).toBe(obj);
  });

  it('passes primitives through unchanged', () => {
    expect(mock('Sunny')).toBe('Sunny');
    expect(mock(42)).toBe(42);
    expect(mock(null)).toBeNull();
  });
});
