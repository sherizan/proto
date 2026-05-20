import { describe, expect, it } from 'vitest';
import { renderQr } from './render-qr';

describe('renderQr', () => {
  it('returns a non-empty string for a URL', () => {
    const out = renderQr('http://localhost:8081');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(20);
  });

  it('produces different output for different URLs', () => {
    const a = renderQr('http://localhost:8081');
    const b = renderQr('http://localhost:9999');
    expect(a).not.toBe(b);
  });
});
