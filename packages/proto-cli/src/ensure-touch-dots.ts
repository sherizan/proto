// Backfill of the Proto-managed dev overlay (components/proto/touch-dots.tsx)
// for projects scaffolded before create-proto shipped it (0.7.10) or before
// it learned point-and-edit (0.8.x). Prototo Desktop's element chip needs the
// overlay mounted in the root layout to resolve a tap to a file:line, so this
// runs on every `proto start`. It only ever writes the managed file and adds
// one wrapper to app/_layout.tsx when that is unambiguous; anything else is
// left alone and the desktop falls back to a label-only reference. Fails open.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOUCH_DOTS_SOURCE } from './touch-dots-source.js';

const MANAGED_HEADER = '// Proto-managed.';
const IMPORT_LINE = "import TouchDots from '../components/proto/touch-dots';";

export function ensureTouchDots(root: string): void {
  try {
    const overlayPath = join(root, 'components', 'proto', 'touch-dots.tsx');
    const existing = existsSync(overlayPath) ? readFileSync(overlayPath, 'utf8') : null;
    if (existing === null) {
      mkdirSync(join(root, 'components', 'proto'), { recursive: true });
      writeFileSync(overlayPath, TOUCH_DOTS_SOURCE);
    } else if (existing.startsWith(MANAGED_HEADER) && existing !== TOUCH_DOTS_SOURCE) {
      // ponytail: a managed overlay always matches this CLI's copy. An older CLI
      // would write an older overlay; fine — the desktop auto-updates the CLI.
      writeFileSync(overlayPath, TOUCH_DOTS_SOURCE);
    }

    const layoutPath = join(root, 'app', '_layout.tsx');
    if (!existsSync(layoutPath)) return;
    const layout = readFileSync(layoutPath, 'utf8');
    if (layout.includes('touch-dots')) return;
    const wrapped = wrapLayout(layout);
    if (wrapped) writeFileSync(layoutPath, wrapped);
  } catch {
    // fail open: the overlay must never block proto start
  }
}

// Wrap the single `return ( … );` of the default export in <TouchDots>. Text
// surgery on purpose: layouts are tiny, and anything with more than one
// parenthesised return is skipped rather than guessed at.
function wrapLayout(layout: string): string | null {
  if (!layout.includes('export default function')) return null;
  const returns = layout.match(/return \(/g);
  if (!returns || returns.length !== 1) return null;
  const open = layout.indexOf('return (');
  const close = layout.lastIndexOf('\n  );');
  if (close < open) return null;

  const body = layout.slice(open + 'return ('.length, close);
  const indented = body.replace(/\n(?=.)/g, '\n  ');
  const jsx = `return (\n    <TouchDots>${indented}\n    </TouchDots>`;
  const withWrap = layout.slice(0, open) + jsx + layout.slice(close);

  const lastImport = withWrap.lastIndexOf('\nimport ');
  const importEnd = withWrap.indexOf('\n', lastImport + 1);
  if (lastImport < 0 || importEnd < 0) return null;
  return `${withWrap.slice(0, importEnd + 1)}${IMPORT_LINE}\n${withWrap.slice(importEnd + 1)}`;
}
