import { describe, expect, it } from 'vitest';
import { renderQr } from './render-qr.js';

describe('renderQr', () => {
  it('returns a non-empty string for a URL', () => {
    const out = renderQr('exp://192.168.1.42:8081');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(20);
  });

  it('produces different output for different URLs', () => {
    const a = renderQr('exp://192.168.1.42:8081');
    const b = renderQr('exp://10.0.0.5:19000');
    expect(a).not.toBe(b);
  });
});
