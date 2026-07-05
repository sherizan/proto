import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  METRO_ERRORS_REL,
  type MetroErrorEntry,
  createMetroScanner,
  persistErrors,
  resetErrorsFile,
} from './metro-errors.js';

// Collects every onChange snapshot; `latest` is the current buffer state.
function collect() {
  const snapshots: MetroErrorEntry[][] = [];
  return {
    onChange: (errors: MetroErrorEntry[]) => snapshots.push(errors.map((e) => ({ ...e }))),
    get latest(): MetroErrorEntry[] {
      return snapshots[snapshots.length - 1] ?? [];
    },
    snapshots,
  };
}

const now = () => '2026-07-05T00:00:00.000Z';

describe('createMetroScanner', () => {
  it('captures a bundling-failed block as a single entry including its follow-up lines', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed('iOS Bundling failed 383ms index.ts (582 modules)');
    scanner.feed('Unable to resolve "components/proto/Buttonn" from "screens/Home.tsx"');
    scanner.feed('');

    expect(c.latest).toHaveLength(1);
    expect(c.latest[0].raw).toBe(
      'iOS Bundling failed 383ms index.ts (582 modules)\nUnable to resolve "components/proto/Buttonn" from "screens/Home.tsx"',
    );
    expect(c.latest[0].at).toBe('2026-07-05T00:00:00.000Z');
  });

  it('captures a SyntaxError code frame until the blank-line boundary', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed('SyntaxError: /Users/x/app/screens/Home.tsx: Unexpected token (12:5)');
    scanner.feed('  10 |   return (');
    scanner.feed('> 12 |       <Text>');
    scanner.feed('     |      ^');
    scanner.feed('');
    scanner.feed('some unrelated later line');

    expect(c.latest).toHaveLength(1);
    expect(c.latest[0].raw).toContain('Unexpected token (12:5)');
    expect(c.latest[0].raw).toContain('> 12 |       <Text>');
    expect(c.latest[0].raw).not.toContain('unrelated');
  });

  it('captures a runtime ERROR device-log line with its stack', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed(' ERROR  TypeError: undefined is not a function');
    scanner.feed('    at Home (screens/Home.tsx:14:10)');

    expect(c.latest).toHaveLength(1);
    expect(c.latest[0].raw).toBe(
      'ERROR  TypeError: undefined is not a function\n    at Home (screens/Home.tsx:14:10)',
    );
  });

  it('a LOG device line closes an open error block instead of joining it', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed(' ERROR  TypeError: undefined is not a function');
    scanner.feed(' LOG  fetch ok');

    expect(c.latest).toHaveLength(1);
    expect(c.latest[0].raw).not.toContain('fetch ok');
  });

  it('a successful Bundled line clears all captured errors', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed('Unable to resolve "x" from "screens/Home.tsx"');
    scanner.feed('');
    expect(c.latest).toHaveLength(1);

    scanner.feed('iOS Bundled 512ms index.ts (582 modules)');
    expect(c.latest).toHaveLength(0);
  });

  it('keeps only the last 5 errors', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    for (let i = 1; i <= 6; i++) {
      scanner.feed(` ERROR  crash number ${i}`);
      scanner.feed('');
    }

    expect(c.latest).toHaveLength(5);
    expect(c.latest[0].raw).toContain('crash number 2');
    expect(c.latest[4].raw).toContain('crash number 6');
  });

  it('collapses an identical repeated error into one entry (Metro re-prints on each reload)', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed('Unable to resolve "x" from "screens/Home.tsx"');
    scanner.feed('');
    scanner.feed('Unable to resolve "x" from "screens/Home.tsx"');
    scanner.feed('');

    expect(c.latest).toHaveLength(1);
  });

  it('strips ANSI color codes before matching and storing', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed('\u001b[31m ERROR \u001b[39m TypeError: boom');
    scanner.feed('');

    expect(c.latest).toHaveLength(1);
    expect(c.latest[0].raw).not.toContain('\u001b');
    expect(c.latest[0].raw).toContain('TypeError: boom');
  });

  it('ignores ordinary output lines', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed('Starting Metro Bundler');
    scanner.feed('› Metro waiting on exp://192.168.1.10:8081');
    scanner.feed(' LOG  hello from the app');

    expect(c.snapshots).toHaveLength(0);
  });

  it('persists an error immediately, before its block is closed by a boundary', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed(' ERROR  the very last line of output');

    expect(c.latest).toHaveLength(1);
    expect(c.latest[0].raw).toContain('the very last line of output');
  });

  it('caps a runaway block at 20 lines', () => {
    const c = collect();
    const scanner = createMetroScanner({ onChange: c.onChange, now });

    scanner.feed(' ERROR  huge stack');
    for (let i = 0; i < 30; i++) scanner.feed(`    at frame${i}`);
    scanner.feed('');

    expect(c.latest).toHaveLength(1);
    expect(c.latest[0].raw.split('\n')).toHaveLength(20);
  });
});

describe('persistErrors / resetErrorsFile', () => {
  const tmpProject = () => fs.mkdtempSync(path.join(os.tmpdir(), 'proto-metro-errors-'));

  it('writes the errors to .proto/metro-errors.json, creating .proto/ if needed', () => {
    const cwd = tmpProject();
    const errors: MetroErrorEntry[] = [{ raw: 'ERROR  boom', at: '2026-07-05T00:00:00.000Z' }];

    persistErrors(cwd, errors, { now: () => '2026-07-05T00:00:01.000Z' });

    const file = JSON.parse(fs.readFileSync(path.join(cwd, METRO_ERRORS_REL), 'utf8'));
    expect(file).toEqual({
      version: 1,
      updatedAt: '2026-07-05T00:00:01.000Z',
      errors: [{ raw: 'ERROR  boom', at: '2026-07-05T00:00:00.000Z' }],
    });
  });

  it('resetErrorsFile writes the empty state so a previous session never leaks', () => {
    const cwd = tmpProject();
    persistErrors(cwd, [{ raw: 'ERROR  old', at: '2026-07-04T00:00:00.000Z' }]);

    resetErrorsFile(cwd);

    const file = JSON.parse(fs.readFileSync(path.join(cwd, METRO_ERRORS_REL), 'utf8'));
    expect(file.errors).toEqual([]);
    expect(file.version).toBe(1);
  });
});
