import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESIGN_GUIDANCE, DESIGN_GUIDANCE_POINTER } from './design-guidance-source.js';

const start = '<!-- prototo-design:start -->';
const end = '<!-- prototo-design:end -->';
function plain(file: string): boolean {
  try { return !lstatSync(file).isSymbolicLink(); }
  catch { return !existsSync(file); }
}
function writeChanged(file: string, content: string): void {
  if (!plain(file)) return;
  if (!existsSync(file) || readFileSync(file, 'utf8') !== content) writeFileSync(file, content);
}
function attach(file: string): void {
  if (!existsSync(file) || !plain(file)) return;
  const text = readFileSync(file, 'utf8');
  if (file.endsWith('CLAUDE.md') && /^\s*@AGENTS\.md\s*$/m.test(text)) return;
  const a = text.indexOf(start), b = text.indexOf(end);
  if ((a < 0) !== (b < 0) || (a >= 0 && (b < a || text.indexOf(start, a + start.length) >= 0 || text.indexOf(end, b + end.length) >= 0))) return;
  const next = a < 0
    ? text + (text.endsWith('\n') ? '\n' : '\n\n') + DESIGN_GUIDANCE_POINTER + '\n'
    : text.slice(0, a) + DESIGN_GUIDANCE_POINTER + text.slice(b + end.length);
  writeChanged(file, next);
}

// Delivered with the CLI so Desktop and terminal agents share one version.
// Only our marked section and managed guide are refreshed; project choices stay intact.
export function ensureDesignGuidance(root: string): void {
  try {
    if (!existsSync(root) || !lstatSync(root).isDirectory() || !plain(root)) return;
    const managed = join(root, '.proto'), dir = join(managed, 'design');
    if (!plain(managed) || !plain(dir) || !plain(join(dir, 'GUIDE.md'))) return;
    mkdirSync(dir, { recursive: true });
    writeChanged(join(dir, 'GUIDE.md'), DESIGN_GUIDANCE);
    attach(join(root, 'AGENTS.md'));
    attach(join(root, 'CLAUDE.md'));
  } catch {
    // Guidance delivery must not prevent a prototype from opening.
  }
}
