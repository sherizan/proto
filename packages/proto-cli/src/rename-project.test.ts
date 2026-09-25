import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { renameProject } from './rename-project';

let dir: string;
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function scaffold(name: string) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-rename-'));
  fs.mkdirSync(path.join(dir, '.proto', 'expo-config'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'proto.config.js'),
    `module.exports = {\n  name: '${name}',\n  theme: 'liquidGlass',\n  screens: { initial: 'Home' },\n};\n`,
  );
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    `${JSON.stringify({ name, version: '0.0.1', private: true }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(dir, '.proto', 'expo-config', 'app.json'),
    `${JSON.stringify({ expo: { name, slug: 'prototo-share', scheme: 'proto' } }, null, 2)}\n`,
  );
}
const read = (rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8');

describe('renameProject (#68)', () => {
  it('renames the three name fields and leaves everything else alone', () => {
    scaffold('google-pay');
    renameProject(dir, 'google-pay-ember');
    expect(read('proto.config.js')).toContain("name: 'google-pay-ember',");
    expect(read('proto.config.js')).toContain("screens: { initial: 'Home' }");
    expect(JSON.parse(read('package.json'))).toEqual({
      name: 'google-pay-ember',
      version: '0.0.1',
      private: true,
    });
    const app = JSON.parse(read('.proto/expo-config/app.json')).expo;
    expect(app.name).toBe('google-pay-ember');
    expect(app.slug).toBe('prototo-share'); // proto share's managed slug, untouched
    expect(app.scheme).toBe('proto');
  });

  it('keeps package.json a valid npm name', () => {
    scaffold('atlas');
    renameProject(dir, 'Atlas Copy 2');
    expect(JSON.parse(read('package.json')).name).toBe('atlas-copy-2');
    expect(read('proto.config.js')).toContain("name: 'Atlas Copy 2',");
  });

  it('skips files that are missing or unreadable instead of throwing', () => {
    scaffold('atlas');
    fs.rmSync(path.join(dir, '.proto'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{ not json');
    expect(() => renameProject(dir, 'atlas-2')).not.toThrow();
    expect(read('proto.config.js')).toContain("name: 'atlas-2',");
  });

  it('escapes quotes in the display name', () => {
    scaffold('atlas');
    renameProject(dir, "Sheri's atlas");
    expect(read('proto.config.js')).toContain("name: 'Sheri\\'s atlas',");
  });
});
