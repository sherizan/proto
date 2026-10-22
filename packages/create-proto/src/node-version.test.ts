import { describe, expect, it } from 'vitest';
import { nodeSupported } from './node-version.js';

describe('nodeSupported', () => {
  it('follows the Expo SDK 58 floor', () => {
    for (const v of ['20.19.0', '22.12.0', '23.5.0', '24.2.0', '25.0.0'])
      expect(nodeSupported(v)).toBe(false);
    for (const v of ['22.13.0', '22.20.5', '24.3.0', '26.9.0', '28.0.0'])
      expect(nodeSupported(v)).toBe(true);
  });
});
