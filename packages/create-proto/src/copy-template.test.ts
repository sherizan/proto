import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { copyTemplate } from './copy-template';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpRoot: string;
let templateRoot: string;
let destRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-copy-test-'));
  templateRoot = path.join(tmpRoot, 'template');
  destRoot = path.join(tmpRoot, 'dest');
  fs.mkdirSync(path.join(templateRoot, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'config.js'), `export default { name: '{{name}}' };`);
  fs.writeFileSync(path.join(templateRoot, 'plain.txt'), `Hello {{name}}, no token here on next line.\nLine 2.`);
  fs.writeFileSync(path.join(templateRoot, 'sub', '.gitkeep'), '');
  fs.writeFileSync(path.join(templateRoot, 'binary.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('copyTemplate', () => {
  it('copies the template tree into dest', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    expect(fs.existsSync(path.join(destRoot, 'config.js'))).toBe(true);
    expect(fs.existsSync(path.join(destRoot, 'plain.txt'))).toBe(true);
    expect(fs.existsSync(path.join(destRoot, 'binary.png'))).toBe(true);
  });

  it('substitutes {{name}} tokens in text files', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    const config = fs.readFileSync(path.join(destRoot, 'config.js'), 'utf8');
    expect(config).toContain("'demo'");
    expect(config).not.toContain('{{name}}');
    const plain = fs.readFileSync(path.join(destRoot, 'plain.txt'), 'utf8');
    expect(plain).toContain('Hello demo');
  });

  it('skips .gitkeep files', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    expect(fs.existsSync(path.join(destRoot, 'sub', '.gitkeep'))).toBe(false);
    expect(fs.existsSync(path.join(destRoot, 'sub'))).toBe(true);
  });

  it('preserves binary files byte-for-byte', async () => {
    await copyTemplate({ templateRoot, destRoot, projectName: 'demo' });
    const original = fs.readFileSync(path.join(templateRoot, 'binary.png'));
    const copied = fs.readFileSync(path.join(destRoot, 'binary.png'));
    expect(copied.equals(original)).toBe(true);
  });
});
