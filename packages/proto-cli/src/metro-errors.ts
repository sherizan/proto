import fs from 'node:fs';
import path from 'node:path';

export type MetroErrorEntry = { raw: string; at: string };

export type MetroErrorsFile = { version: 1; updatedAt: string; errors: MetroErrorEntry[] };

export const METRO_ERRORS_REL = path.join('.proto', 'metro-errors.json');

export function persistErrors(
  cwd: string,
  errors: MetroErrorEntry[],
  opts?: { now?: () => string },
): void {
  const now = opts?.now ?? (() => new Date().toISOString());
  const file: MetroErrorsFile = { version: 1, updatedAt: now(), errors };
  const target = path.join(cwd, METRO_ERRORS_REL);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`);
}

export function resetErrorsFile(cwd: string): void {
  persistErrors(cwd, []);
}

export type MetroScanner = { feed: (line: string) => void };

export type MetroScannerOptions = {
  onChange: (errors: MetroErrorEntry[]) => void;
  now?: () => string;
  max?: number;
  maxBlockLines?: number;
};

// biome-ignore lint/suspicious/noControlCharactersInRegex: ESC is exactly what ANSI stripping matches
const ANSI_RE = /\u001b\[[0-9;?]*[a-zA-Z]/g;

// A successful rebuild means every captured error is stale.
const CLEAR_RE = /\bBundled\b/;

// Lines that begin an error incident in Metro's stream.
const START_RES = [/Bundling failed/, /Unable to resolve/, /SyntaxError/, /^\s*ERROR\s/];

// Lines that end an open incident: blank lines and other stream events.
const BOUNDARY_RES = [/^\s*$/, /^\s*(LOG|WARN|INFO|DEBUG)\s/, /^›/];

type Block = { lines: string[]; at: string };

export function createMetroScanner(options: MetroScannerOptions): MetroScanner {
  const now = options.now ?? (() => new Date().toISOString());
  const max = options.max ?? 5;
  const maxBlockLines = options.maxBlockLines ?? 20;

  const blocks: Block[] = [];
  let open: Block | null = null;

  const rawOf = (b: Block) => b.lines.join('\n').trim();
  const emit = () => options.onChange(blocks.map((b) => ({ raw: rawOf(b), at: b.at })));

  const closeOpen = () => {
    if (!open) return;
    const closed = open;
    open = null;
    // Metro re-prints the same error on every reload attempt — keep the
    // newest occurrence only.
    const raw = rawOf(closed);
    const dupes = blocks.filter((b) => b !== closed && rawOf(b) === raw);
    if (dupes.length > 0) {
      for (const d of dupes) blocks.splice(blocks.indexOf(d), 1);
      emit();
    }
  };

  return {
    feed(line: string) {
      const text = line.replace(ANSI_RE, '');

      if (CLEAR_RE.test(text)) {
        open = null;
        if (blocks.length > 0) {
          blocks.length = 0;
          emit();
        }
        return;
      }

      if (open) {
        if (BOUNDARY_RES.some((re) => re.test(text))) {
          closeOpen();
          return;
        }
        if (open.lines.length < maxBlockLines) {
          open.lines.push(text);
          emit();
        }
        return;
      }

      if (START_RES.some((re) => re.test(text))) {
        open = { lines: [text], at: now() };
        blocks.push(open);
        if (blocks.length > max) blocks.shift();
        emit();
      }
    },
  };
}
