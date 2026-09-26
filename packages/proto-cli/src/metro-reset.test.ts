import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { markMetroReset, takeMetroReset } from './metro-reset.js';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-metro-reset-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('metro reset marker', () => {
  it('is absent by default', () => {
    expect(takeMetroReset(root)).toBe(false);
  });

  it('is written by upgrade and consumed exactly once by start', () => {
    markMetroReset(root);
    expect(fs.existsSync(path.join(root, '.proto', 'metro-reset'))).toBe(true);
    expect(takeMetroReset(root)).toBe(true);
    expect(takeMetroReset(root)).toBe(false);
  });
});
