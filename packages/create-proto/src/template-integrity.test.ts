import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, '../template');

function walkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

describe('template integrity', () => {
  it('never ships test files into a designer project (they import vitest)', () => {
    // proto-components keeps tests beside source; sync-template must strip them.
    const vendored = path.join(templateDir, 'components/proto');
    const tests = walkFiles(vendored).filter((f) => /\.test\.tsx?$/.test(f));
    expect(tests).toEqual([]);
  });

  it('pins react-dom to the same version as react (avoids the ERESOLVE that breaks proto add)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(templateDir, 'package.json'), 'utf8'));
    const react = pkg.dependencies?.react;
    const reactDom = pkg.dependencies?.['react-dom'];
    expect(react).toBeTruthy();
    // expo-router pulls react-dom as an optional peer; if it's unpinned it floats to a
    // newer patch that demands a newer react, and every `expo install` / `proto add` fails.
    expect(reactDom).toBe(react);
  });
});
