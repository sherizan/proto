import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { findConfig } from './find-config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-find-test-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('findConfig', () => {
  it('returns ok with resolved path when proto.config.js exists', () => {
    const configPath = path.join(tmpRoot, 'proto.config.js');
    fs.writeFileSync(configPath, 'export default {};');
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.root).toBe(tmpRoot);
      expect(result.configPath).toBe(configPath);
    }
  });

  it('also accepts proto.config.mjs', () => {
    const configPath = path.join(tmpRoot, 'proto.config.mjs');
    fs.writeFileSync(configPath, 'export default {};');
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configPath).toBe(configPath);
  });

  it('also accepts proto.config.cjs', () => {
    const configPath = path.join(tmpRoot, 'proto.config.cjs');
    fs.writeFileSync(configPath, 'module.exports = {};');
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configPath).toBe(configPath);
  });

  it('also accepts proto.config.ts', () => {
    const configPath = path.join(tmpRoot, 'proto.config.ts');
    fs.writeFileSync(configPath, 'export default {};');
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configPath).toBe(configPath);
  });

  it('returns the friendly reason when no config is found', () => {
    const result = findConfig(tmpRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/prototo project/i);
  });

  it('does not walk up directories', () => {
    const child = path.join(tmpRoot, 'child');
    fs.mkdirSync(child);
    fs.writeFileSync(path.join(tmpRoot, 'proto.config.js'), 'export default {};');
    const result = findConfig(child);
    expect(result.ok).toBe(false);
  });
});
