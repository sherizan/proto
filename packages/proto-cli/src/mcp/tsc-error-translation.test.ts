import { describe, expect, test } from 'vitest';
import { translateTscError } from './tsc-error-translation.js';

describe('translateTscError', () => {
  test('clean output reports no errors', () => {
    expect(translateTscError('')).toBe('No errors.');
  });

  test('translates an unresolved-module error and names the screen file', () => {
    const raw =
      "screens/Settings.tsx(3,21): error TS2307: Cannot find module '../components/prto'.";
    const out = translateTscError(raw);
    expect(out).toContain('Settings.tsx');
    expect(out).toContain('import couldn’t be resolved');
  });

  test('translates a missing-property error as a prop mismatch', () => {
    const raw =
      "screens/Home.tsx(8,12): error TS2339: Property 'labl' does not exist on type 'ButtonProps'.";
    const out = translateTscError(raw);
    expect(out).toContain('Home.tsx');
    expect(out).toContain('prop doesn’t match');
  });

  test('translates a non-assignable type error as a value mismatch', () => {
    const raw =
      "screens/Home.tsx(8,12): error TS2322: Type 'string' is not assignable to type 'number'.";
    const out = translateTscError(raw);
    expect(out).toContain('Home.tsx');
    expect(out).toContain('value type mismatch');
  });

  test('falls back to a generic type-error message for unrecognised errors', () => {
    const raw = "screens/Home.tsx(2,7): error TS2304: Cannot find name 'Foo'.";
    const out = translateTscError(raw);
    expect(out).toContain('Home.tsx');
    expect(out).toContain('Ask Claude Code to fix it');
  });

  test('reports one friendly line per error across multiple files', () => {
    const raw = [
      "screens/Home.tsx(3,21): error TS2307: Cannot find module './x'.",
      "screens/Settings.tsx(8,12): error TS2322: Type 'string' is not assignable to type 'number'.",
    ].join('\n');
    const out = translateTscError(raw);
    expect(out).toContain('Home.tsx');
    expect(out).toContain('Settings.tsx');
    expect(out.split('\n')).toHaveLength(2);
  });

  test('deduplicates identical translated lines', () => {
    const raw = [
      "screens/Home.tsx(3,21): error TS2307: Cannot find module './x'.",
      "screens/Home.tsx(9,21): error TS2307: Cannot find module './y'.",
    ].join('\n');
    const out = translateTscError(raw);
    expect(out.split('\n')).toHaveLength(1);
  });

  test('handles the pretty (TTY) error format too', () => {
    const raw =
      "screens/Settings.tsx:3:21 - error TS2307: Cannot find module '../components/prto'.";
    const out = translateTscError(raw);
    expect(out).toContain('Settings.tsx');
    expect(out).toContain('import couldn’t be resolved');
  });
});
