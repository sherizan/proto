import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { clearCaches } from './clear-caches';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-clear-test-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('clearCaches', () => {
  it('removes .expo/ when it exists', async () => {
    const expoDir = path.join(tmpRoot, '.expo');
    fs.mkdirSync(expoDir);
    fs.writeFileSync(path.join(expoDir, 'a.json'), '{}');

    const result = await clearCaches(tmpRoot);

    expect(fs.existsSync(expoDir)).toBe(false);
    expect(result.cleared).toContain('.expo');
  });

  it('removes node_modules/.cache/ when it exists', async () => {
    const cacheDir = path.join(tmpRoot, 'node_modules', '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'b.bin'), 'x');

    const result = await clearCaches(tmpRoot);

    expect(fs.existsSync(cacheDir)).toBe(false);
    expect(result.cleared).toContain('node_modules/.cache');
  });

  it('returns an empty cleared list when nothing exists', async () => {
    const result = await clearCaches(tmpRoot);
    expect(result.cleared).toEqual([]);
  });

  it('leaves node_modules/ in place when only .cache is present', async () => {
    const nodeModules = path.join(tmpRoot, 'node_modules');
    const cacheDir = path.join(nodeModules, '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(nodeModules, 'package.json'), '{}');

    await clearCaches(tmpRoot);

    expect(fs.existsSync(cacheDir)).toBe(false);
    expect(fs.existsSync(nodeModules)).toBe(true);
    expect(fs.existsSync(path.join(nodeModules, 'package.json'))).toBe(true);
  });
});
