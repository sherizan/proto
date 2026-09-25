import fs from 'node:fs';
import path from 'node:path';

// pnpm ≥ 9 refuses to run a dependency's build script until the project's
// pnpm-workspace.yaml allowlists it, and exits 1 on EVERY install until then.
// pnpm 11 also writes a placeholder line ("set this to true or false") that
// nobody flips, so the retry-once idea never worked. Flip it — a library the
// designer asked for gets to build.

const PLACEHOLDER = /: set this to true or false$/gm;

export function parseIgnoredBuilds(output: string): string[] {
  const m = /Ignored build scripts: ([^\n]+)/.exec(output);
  if (!m) return [];
  return (m[1] ?? '')
    .split(',')
    .map((s) => s.trim().replace(/@[^@/]+$/, ''))
    .filter(Boolean);
}

export function allowBuilds(yaml: string, names: string[]): string {
  let out = yaml.replace(PLACEHOLDER, ': true');
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const missing = names.filter((n) => !new RegExp(`^  '?${escape(n)}'?: true$`, 'm').test(out));
  if (missing.length === 0) return out;
  const lines = missing.map((n) => `  '${n}': true`).join('\n');
  return /^allowBuilds:[ \t]*$/m.test(out)
    ? out.replace(/^allowBuilds:[ \t]*$/m, `allowBuilds:\n${lines}`)
    : `${out.replace(/\n*$/, '\n')}allowBuilds:\n${lines}\n`;
}

/** Rewrite the project's pnpm-workspace.yaml; true when something changed. */
export function healIgnoredBuilds(root: string, output = ''): boolean {
  const file = path.join(root, 'pnpm-workspace.yaml');
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, 'utf8');
  const after = allowBuilds(before, parseIgnoredBuilds(output));
  if (after === before) return false;
  fs.writeFileSync(file, after);
  return true;
}
